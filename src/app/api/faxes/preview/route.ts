import { auth } from "@/auth"
import { buildCoverSheet } from "@/lib/build-cover"
import { prependCoverSheet } from "@/lib/cover-sheet"
import { mergePdfs } from "@/lib/merge-pdfs"
import { NextResponse } from "next/server"

// Renders the actual cover sheet (and merges an attached PDF) exactly as the
// fax will look, without sending or persisting anything. Returns a PDF.
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const form = await req.formData()
  const uploadedFiles = form.getAll("files") as File[]
  const recipientName = (form.get("recipientName") as string | null) ?? ""
  const toNumber = (form.get("to") as string | null) ?? ""
  const fromNumber = (form.get("from") as string | null) ?? ""
  const fromName = (form.get("fromName") as string | null) ?? ""
  const subject = (form.get("subject") as string | null) ?? ""
  const coverSheetMessage = (form.get("coverSheetMessage") as string | null) ?? ""
  const contactInfo = (form.get("contactInfo") as string | null) ?? ""
  const coverSheetTemplateId = (form.get("coverSheetTemplateId") as string | null) || null
  const hasCoverSheet = form.get("hasCoverSheet") !== "false"

  const coverDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })

  // Only PDF files can be page-merged; images are skipped in preview
  let fileBytes: Uint8Array | null = null
  const pdfFiles = uploadedFiles.filter((f) => (f.type || "").includes("pdf") || f.name.toLowerCase().endsWith(".pdf"))
  if (pdfFiles.length === 1) {
    fileBytes = new Uint8Array(await pdfFiles[0].arrayBuffer())
  } else if (pdfFiles.length > 1) {
    const parts = await Promise.all(pdfFiles.map((f) => f.arrayBuffer().then((b) => new Uint8Array(b))))
    fileBytes = await mergePdfs(parts)
  }

  let pdfBytes: Uint8Array | null = null
  try {
    if (hasCoverSheet) {
      const cover = await buildCoverSheet({
        coverSheetTemplateId, fromName, fromNumber, recipientName,
        toNumber, subject, coverSheetMessage, contactInfo, date: coverDate,
      })
      pdfBytes = fileBytes ? await prependCoverSheet(cover.coverBytes, fileBytes) : cover.coverBytes
    } else if (fileBytes) {
      pdfBytes = fileBytes
    }
  } catch (e) {
    console.error("Preview generation failed:", e)
    return NextResponse.json({ error: "Could not generate preview" }, { status: 500 })
  }

  if (!pdfBytes) {
    return NextResponse.json({ error: "Enable the cover sheet or attach a PDF to preview." }, { status: 400 })
  }

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=fax-preview.pdf",
      "Cache-Control": "no-store",
    },
  })
}
