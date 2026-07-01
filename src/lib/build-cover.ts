import { db } from "@/lib/db"
import { coverSheetTemplates } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { generateCoverSheet } from "@/lib/cover-sheet"
import { renderTrdxToPdf } from "@/lib/trdx"

export interface CoverInput {
  coverSheetTemplateId?: string | null
  fromName: string
  fromNumber: string
  recipientName: string
  toNumber: string
  subject: string
  coverSheetMessage: string
  contactInfo: string
  date: string
}

export interface CoverResult {
  coverBytes: Uint8Array
  // Fields after applying any template overrides — used for storing the fax row.
  resolvedFromName: string
  coverSheetMessage: string
  contactInfo: string
}

/**
 * Builds the cover-sheet PDF for a fax, shared by the send and preview routes so
 * the preview is exactly what gets sent. A template's uploaded design file is
 * preferred (PDF used as-is, TRDX rendered in-process); otherwise the standard
 * cover sheet is generated from the text fields.
 */
export async function buildCoverSheet(input: CoverInput): Promise<CoverResult> {
  let resolvedFromName = input.fromName
  let coverSheetMessage = input.coverSheetMessage
  let contactInfo = input.contactInfo

  let coverTemplate: typeof coverSheetTemplates.$inferSelect | null = null
  if (input.coverSheetTemplateId) {
    coverTemplate = (await db.query.coverSheetTemplates.findFirst({
      where: eq(coverSheetTemplates.id, input.coverSheetTemplateId),
    })) ?? null
    if (coverTemplate) {
      if (coverTemplate.fromName) resolvedFromName = coverTemplate.fromName
      if (coverTemplate.coverSheetMessage) coverSheetMessage = coverTemplate.coverSheetMessage
      if (coverTemplate.contactInfo) contactInfo = coverTemplate.contactInfo
    }
  }

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
          // Fetch the template's logo (if any) and pass as a base64 data URL so
          // TRDX templates with a PictureBox =Parameters.logoImage.Value can render it.
          let logoImage = ""
          if (coverTemplate?.logoUrl) {
            try {
              const lr = await fetch(coverTemplate.logoUrl)
              if (lr.ok) {
                const mime = lr.headers.get("content-type") ?? "image/png"
                const buf = Buffer.from(await lr.arrayBuffer())
                logoImage = `data:${mime};base64,${buf.toString("base64")}`
              }
            } catch { /* leave empty */ }
          }
          coverBytes = await renderTrdxToPdf(Buffer.from(designBytes).toString("utf-8"), {
            recipientName: input.recipientName, recipient: input.recipientName, toName: input.recipientName,
            toNumber: input.toNumber, toFax: input.toNumber, faxNumber: input.toNumber,
            fromName: resolvedFromName, from: resolvedFromName, sender: resolvedFromName,
            fromNumber: input.fromNumber, fromFax: input.fromNumber,
            subject: input.subject,
            message: coverSheetMessage, coverSheetMessage, body: coverSheetMessage,
            contactInfo, contact: contactInfo,
            date: input.date,
            logoImage,
          })
        }
      }
    } catch {
      coverBytes = null // fall back below
    }
  }

  if (!coverBytes) {
    // For the generated cover sheet, pull the template's logo (if any) so it
    // appears at the top of the page.
    let logoBytes: Uint8Array | null = null
    if (coverTemplate?.logoUrl) {
      try {
        const res = await fetch(coverTemplate.logoUrl)
        if (res.ok) logoBytes = new Uint8Array(await res.arrayBuffer())
      } catch {
        logoBytes = null
      }
    }

    coverBytes = await generateCoverSheet({
      fromName: resolvedFromName,
      fromNumber: input.fromNumber,
      recipientName: input.recipientName,
      toNumber: input.toNumber,
      subject: input.subject,
      message: coverSheetMessage,
      contactInfo,
      date: input.date,
      logoBytes,
    })
  }

  return { coverBytes, resolvedFromName, coverSheetMessage, contactInfo }
}
