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

/** Page count of a PDF; returns 0 if the bytes aren't a readable PDF (e.g. an image). */
export async function countPdfPages(bytes: Uint8Array): Promise<number> {
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
    return doc.getPageCount()
  } catch {
    return 0
  }
}
