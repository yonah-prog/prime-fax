import { PDFDocument } from "pdf-lib"

export async function mergePdfs(parts: Uint8Array[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create()
  for (const part of parts) {
    const doc = await PDFDocument.load(part)
    const pages = await merged.copyPages(doc, doc.getPageIndices())
    pages.forEach((p) => merged.addPage(p))
  }
  return merged.save()
}
