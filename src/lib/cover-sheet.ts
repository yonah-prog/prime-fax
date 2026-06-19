import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

export interface CoverSheetOptions {
  fromName: string
  fromNumber: string
  recipientName: string
  toNumber: string
  subject: string
  message: string
  contactInfo: string
  date: string
}

// StandardFonts.Helvetica is WinAnsi-encoded and throws on characters it can't
// represent (emoji, CJK, smart quotes, etc.). Normalize common typographic
// characters and strip anything still outside the printable Latin-1 range so a
// stray character in a name/subject/message never 500s a fax send.
function toWinAnsi(text: string): string {
  return (text ?? "")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "")
}

export async function generateCoverSheet(opts: CoverSheetOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792]) // Letter
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const { width, height } = page.getSize()
  const margin = 60
  let y = height - margin

  const line = (text: string, size = 11, isBold = false, color = rgb(0, 0, 0)) => {
    page.drawText(toWinAnsi(text), { x: margin, y, font: isBold ? bold : font, size, color })
    y -= size + 4
  }

  const gap = (px = 12) => { y -= px }

  // Header bar
  page.drawRectangle({ x: 0, y: height - 50, width, height: 50, color: rgb(0.13, 0.31, 0.6) })
  page.drawText("FAX COVER SHEET", {
    x: margin, y: height - 34,
    font: bold, size: 16, color: rgb(1, 1, 1),
  })

  y = height - 80

  line(`Date: ${opts.date}`, 11, true)
  gap()
  line("TO", 9, false, rgb(0.4, 0.4, 0.4))
  line(opts.recipientName || "—", 13, true)
  line(`Fax: ${opts.toNumber}`, 11)

  gap(16)
  line("FROM", 9, false, rgb(0.4, 0.4, 0.4))
  line(opts.fromName || "—", 13, true)
  line(`Fax: ${opts.fromNumber}`, 11)
  if (opts.contactInfo) {
    gap(4)
    for (const l of opts.contactInfo.split("\n").slice(0, 4)) {
      line(l.trim(), 10)
    }
  }

  if (opts.subject) {
    gap(16)
    line("SUBJECT", 9, false, rgb(0.4, 0.4, 0.4))
    line(opts.subject, 12, true)
  }

  if (opts.message) {
    gap(20)
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
    gap(12)
    line("MESSAGE", 9, false, rgb(0.4, 0.4, 0.4))
    gap(6)
    const words = toWinAnsi(opts.message).split(" ")
    let currentLine = ""
    for (const word of words) {
      const test = currentLine ? `${currentLine} ${word}` : word
      const w = font.widthOfTextAtSize(test, 10)
      if (w > width - margin * 2) {
        line(currentLine, 10)
        currentLine = word
      } else {
        currentLine = test
      }
    }
    if (currentLine) line(currentLine, 10)
  }

  // Footer
  page.drawText("CONFIDENTIAL FAX TRANSMISSION", {
    x: margin, y: 30, font, size: 8, color: rgb(0.5, 0.5, 0.5),
  })

  return doc.save()
}

export async function prependCoverSheet(coverBytes: Uint8Array, docBytes: Uint8Array): Promise<Uint8Array> {
  const cover = await PDFDocument.load(coverBytes, { ignoreEncryption: true })
  const doc = await PDFDocument.load(docBytes, { ignoreEncryption: true })
  const merged = await PDFDocument.create()

  const coverPages = await merged.copyPages(cover, cover.getPageIndices())
  coverPages.forEach((p) => merged.addPage(p))

  const docPages = await merged.copyPages(doc, doc.getPageIndices())
  docPages.forEach((p) => merged.addPage(p))

  return merged.save()
}
