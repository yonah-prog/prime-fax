import { auth } from "@/auth"
import { db } from "@/lib/db"
import { faxes, coverSheetTemplates, phoneNumbers } from "@/lib/db/schema"
import { sendFax } from "@/lib/telnyx"
import { uploadToR2 } from "@/lib/storage"
import { generateCoverSheet, prependCoverSheet } from "@/lib/cover-sheet"
import { renderTrdxToPdf } from "@/lib/trdx"
import { audit } from "@/lib/audit"
import { uploadToDriveForUser } from "@/lib/google-drive"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { randomUUID } from "crypto"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const form = await req.formData()
  const file = form.get("file") as File | null

  // Support comma-separated or JSON array of recipients for broadcast
  const toRaw = form.get("to") as string | null
  const recipients: string[] = toRaw
    ? toRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : []
  if (recipients.length === 0) {
    return NextResponse.json({ error: "Recipient fax number is required" }, { status: 400 })
  }

  const fromNumber = (form.get("from") as string | null)?.trim() || process.env.TELNYX_FROM_NUMBER!
  const fromName = (form.get("fromName") as string | null) ?? ""
  const recipientName = (form.get("recipientName") as string | null) ?? ""
  const subject = (form.get("subject") as string | null) ?? ""
  const hasCoverSheet = form.get("hasCoverSheet") === "true"
  const coverSheetTemplateId = (form.get("coverSheetTemplateId") as string | null) || null
  let coverSheetMessage = (form.get("coverSheetMessage") as string | null) ?? ""
  let contactInfo = (form.get("contactInfo") as string | null) ?? ""
  let resolvedFromName = fromName
  const pageSize = (form.get("pageSize") as "letter" | "legal" | "a4" | null) ?? "letter"
  const resolution = (form.get("resolution") as "fine" | "standard" | null) ?? "fine"
  const scheduledAtRaw = form.get("scheduledAt") as string | null
  const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null

  // If a template ID was supplied, load it and use its fields as overrides
  let coverTemplate: typeof coverSheetTemplates.$inferSelect | null = null
  if (coverSheetTemplateId) {
    coverTemplate = (await db.query.coverSheetTemplates.findFirst({
      where: eq(coverSheetTemplates.id, coverSheetTemplateId),
    })) ?? null
    if (coverTemplate) {
      if (coverTemplate.fromName) resolvedFromName = coverTemplate.fromName
      if (coverTemplate.coverSheetMessage) coverSheetMessage = coverTemplate.coverSheetMessage
      if (coverTemplate.contactInfo) contactInfo = coverTemplate.contactInfo
    }
  }

  let fileBytes: Uint8Array | null = null
  let fileName = "fax.pdf"
  let contentType = "application/pdf"

  if (file) {
    fileBytes = new Uint8Array(await file.arrayBuffer())
    fileName = file.name
    contentType = file.type || "application/pdf"
  }

  // Build PDF (cover + doc) once — reused for all recipients in broadcast
  if (hasCoverSheet) {
    const coverDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })

    // Prefer a custom design file uploaded with the template: a PDF is used
    // as-is; a TRDX is rendered to PDF in-process. Fall back to the generated
    // cover sheet if there's no file, or rendering/fetching fails.
    let coverBytes: Uint8Array | null = null
    if (coverTemplate?.fileUrl) {
      try {
        const res = await fetch(coverTemplate.fileUrl)
        if (res.ok) {
          const designBytes = new Uint8Array(await res.arrayBuffer())
          const ext = (coverTemplate.fileName ?? "").split(".").pop()?.toLowerCase()
          const isPdf = ext === "pdf" || (res.headers.get("content-type") ?? "").includes("pdf")
          if (isPdf) {
            coverBytes = designBytes
          } else if (ext === "trdx" || ext === "xml") {
            coverBytes = await renderTrdxToPdf(Buffer.from(designBytes).toString("utf-8"), {
              recipientName, recipient: recipientName, toName: recipientName,
              toNumber: recipients[0], toFax: recipients[0], faxNumber: recipients[0],
              fromName: resolvedFromName, from: resolvedFromName, sender: resolvedFromName,
              fromNumber, fromFax: fromNumber,
              subject,
              message: coverSheetMessage, coverSheetMessage, body: coverSheetMessage,
              contactInfo, contact: contactInfo,
              date: coverDate,
            })
          }
        }
      } catch {
        coverBytes = null // fall back below
      }
    }

    if (!coverBytes) {
      coverBytes = await generateCoverSheet({
        fromName: resolvedFromName,
        fromNumber,
        recipientName,
        toNumber: recipients[0],
        subject,
        message: coverSheetMessage,
        contactInfo,
        date: coverDate,
      })
    }

    fileBytes = fileBytes ? await prependCoverSheet(coverBytes, fileBytes) : coverBytes
    if (!file) fileName = "cover-sheet.pdf"
    contentType = "application/pdf"
  }

  if (!fileBytes) {
    return NextResponse.json({ error: "A document or cover sheet is required" }, { status: 400 })
  }

  const fileBuffer = Buffer.from(fileBytes)
  const key = `outbound/${randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`
  const fileUrl = await uploadToR2(fileBuffer, key, contentType)

  // Upload to Google Drive for the sending user (fire-and-forget). Use the
  // sending number's configured Drive folder if one is set, else the user's.
  if (session.user?.id) {
    const fromRecord = await db.query.phoneNumbers.findFirst({
      where: eq(phoneNumbers.number, fromNumber),
      columns: { googleDriveFolder: true },
    })
    const driveFileName = `Sent-${fileName}-${new Date().toISOString().slice(0, 10)}.pdf`
    uploadToDriveForUser(session.user.id, fileBuffer, driveFileName, contentType, fromRecord?.googleDriveFolder)
      .catch((e) => console.error("Drive upload (outbound) failed:", e))
  }

  // Broadcast ID links all recipients in a single broadcast together
  const broadcastId = recipients.length > 1 ? randomUUID() : undefined
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/telnyx`
  const results: { id: string; toNumber: string; status: string }[] = []

  for (const toNumber of recipients) {
    const [fax] = await db
      .insert(faxes)
      .values({
        userId: session.user?.id,
        direction: "outbound",
        status: scheduledAt ? "scheduled" : "queued",
        fromNumber,
        fromName: resolvedFromName || null,
        toNumber,
        recipientName: recipientName || null,
        subject: subject || null,
        hasCoverSheet,
        coverSheetMessage: coverSheetMessage || null,
        contactInfo: contactInfo || null,
        pageSize,
        resolution,
        fileUrl,
        fileName,
        scheduledAt,
        broadcastId: broadcastId ?? null,
      })
      .returning()

    if (scheduledAt) {
      results.push({ id: fax.id, toNumber, status: "scheduled" })
      audit({ userId: session.user?.id, userEmail: session.user?.email, action: "fax_scheduled", resourceType: "fax", resourceId: fax.id, meta: { toNumber, scheduledAt: scheduledAt.toISOString() } })
      continue
    }

    try {
      const telnyxFax = await sendFax({ from: fromNumber, to: toNumber, mediaUrl: fileUrl, webhookUrl })
      await db.update(faxes).set({ telnyxFaxId: telnyxFax.id, status: "sending" }).where(eq(faxes.id, fax.id))
      audit({ userId: session.user?.id, userEmail: session.user?.email, action: "fax_sent", resourceType: "fax", resourceId: fax.id, meta: { toNumber } })
      results.push({ id: fax.id, toNumber, status: "sending" })
    } catch (err) {
      await db.update(faxes).set({ status: "failed", errorMessage: String(err) }).where(eq(faxes.id, fax.id))
      results.push({ id: fax.id, toNumber, status: "failed" })
    }
  }

  const anySuccess = results.some((r) => r.status === "sending" || r.status === "scheduled")
  return NextResponse.json({ results }, { status: anySuccess ? 200 : 500 })
}
