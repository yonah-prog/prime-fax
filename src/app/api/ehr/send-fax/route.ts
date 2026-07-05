import { db } from "@/lib/db"
import { faxes } from "@/lib/db/schema"
import { sendFax } from "@/lib/telnyx"
import { uploadToR2 } from "@/lib/storage"
import { generateCoverSheet, prependCoverSheet } from "@/lib/cover-sheet"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { validateMedplumToken } from "@/lib/medplum-auth"

// Machine-to-machine endpoint for the EHR.
// Authenticated via Medplum JWT — no NextAuth session needed.
export async function POST(req: Request) {
  if (!await validateMedplumToken(req.headers.get("authorization") ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const form = await req.formData()
  const file = form.get("file") as File | null
  const to = (form.get("to") as string | null)?.trim()
  if (!to) return NextResponse.json({ error: "Recipient fax number is required" }, { status: 400 })

  const fromNumber = process.env.TELNYX_FROM_NUMBER!
  const fromName = (form.get("fromName") as string | null) ?? "Premier Health"
  const recipientName = (form.get("recipientName") as string | null) ?? ""
  const subject = (form.get("subject") as string | null) ?? ""
  const hasCoverSheet = form.get("hasCoverSheet") === "true"
  const coverSheetMessage = (form.get("coverSheetMessage") as string | null) ?? ""

  let fileBytes: Uint8Array | null = file ? new Uint8Array(await file.arrayBuffer()) : null
  let fileName = file?.name ?? "fax.pdf"
  let contentType = file?.type || "application/pdf"

  const ALLOWED_TYPES = ['application/pdf', 'image/tiff', 'image/png', 'image/jpeg']
  if (file && !ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: `File type ${file.type} not supported. Use PDF, TIFF, PNG, or JPEG.` }, { status: 400 })
  }
  if (fileBytes && fileBytes.length > 52428800) {
    return NextResponse.json({ error: 'File too large. Maximum size is 50 MB.' }, { status: 400 })
  }

  if (hasCoverSheet) {
    const coverBytes = await generateCoverSheet({
      fromName,
      fromNumber,
      recipientName,
      toNumber: to,
      subject,
      message: coverSheetMessage,
      contactInfo: "",
      date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    })
    fileBytes = fileBytes ? await prependCoverSheet(coverBytes, fileBytes) : coverBytes
    if (!file) fileName = "cover-sheet.pdf"
    contentType = "application/pdf"
  }

  if (!fileBytes) {
    return NextResponse.json({ error: "A document or cover sheet is required" }, { status: 400 })
  }

  if (!/^\+1\d{10}$/.test(to)) {
    return NextResponse.json({ error: 'Invalid fax number. Must be a 10-digit US number.' }, { status: 400 })
  }

  const fileBuffer = Buffer.from(fileBytes)
  const key = `outbound/${randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`
  const fileUrl = await uploadToR2(fileBuffer, key, contentType)

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/telnyx`

  const [fax] = await db
    .insert(faxes)
    .values({
      userId: null,
      direction: "outbound",
      status: "queued",
      fromNumber,
      fromName: fromName || null,
      toNumber: to,
      recipientName: recipientName || null,
      subject: subject || null,
      hasCoverSheet,
      coverSheetMessage: coverSheetMessage || null,
      fileUrl,
      fileName,
    })
    .returning()

  try {
    const telnyxFax = await sendFax({ from: fromNumber, to, mediaUrl: fileUrl, webhookUrl })
    await db.update(faxes).set({ telnyxFaxId: telnyxFax.id, status: "sending" }).where(eq(faxes.id, fax.id))
    return NextResponse.json({ id: fax.id, status: "sending" })
  } catch (err) {
    await db.update(faxes).set({ status: "failed", errorMessage: String(err) }).where(eq(faxes.id, fax.id))
    return NextResponse.json({ error: String(err), id: fax.id, status: "failed" }, { status: 500 })
  }
}
