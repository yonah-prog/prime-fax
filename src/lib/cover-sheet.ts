import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from "pdf-lib"

export interface CoverSheetOptions {
  fromName: string
  fromNumber: string
  recipientName: string
  toNumber: string
  subject: string
  message: string
  contactInfo: string
  date: string
  /** Optional logo image bytes (PNG or JPEG) drawn at the top of the page. */
  logoBytes?: Uint8Array | null
}

// The HIPAA confidentiality notice printed on every generated cover sheet.
export const CONFIDENTIALITY_NOTICE =
  "This fax contains confidential information intended only for the designated recipient(s). " +
  "If you received this fax in error, please notify the sender immediately and destroy all copies. " +
  "Do not disclose, copy, or distribute without authorization. (45 CFR 164.530)"

const BLUE = rgb(0.13, 0.31, 0.6)
const GRAY = rgb(0.4, 0.4, 0.4)

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
    .replace(/ /g, " ")
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "")
}

// Greedy word-wrap to a max width; returns the wrapped lines.
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = toWinAnsi(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

export async function generateCoverSheet(opts: CoverSheetOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792]) // Letter
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const { width, height } = page.getSize()
  const margin = 54
  const contentWidth = width - margin * 2
  let y = height - margin

  const line = (text: string, size = 11, isBold = false, color = rgb(0, 0, 0)) => {
    page.drawText(toWinAnsi(text), { x: margin, y, font: isBold ? bold : font, size, color })
    y -= size + 4
  }
  const gap = (px = 12) => { y -= px }

  // ── Logo (optional) — sits at the very top; room is reserved for it ──
  if (opts.logoBytes && opts.logoBytes.length) {
    let img: PDFImage | null = null
    try {
      img = await doc.embedPng(opts.logoBytes)
    } catch {
      try { img = await doc.embedJpg(opts.logoBytes) } catch { img = null }
    }
    if (img) {
      const maxW = 220, maxH = 70
      const scale = Math.min(maxW / img.width, maxH / img.height, 1)
      const w = img.width * scale, h = img.height * scale
      page.drawImage(img, { x: margin, y: y - h, width: w, height: h })
      y -= h + 18
    }
  }

  // ── Title + date ──
  page.drawText("FAX COVER SHEET", { x: margin, y: y - 20, font: bold, size: 22, color: BLUE })
  const dateStr = `Date: ${opts.date}`
  page.drawText(toWinAnsi(dateStr), {
    x: width - margin - font.widthOfTextAtSize(dateStr, 10),
    y: y - 14, font, size: 10, color: GRAY,
  })
  y -= 32
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 2, color: BLUE })
  y -= 22

  // ── To ──
  line("TO", 9, false, GRAY)
  line(opts.recipientName || "—", 14, true)
  line(`Fax: ${opts.toNumber}`, 11)

  // ── From — the fax number is whichever line this template is sent from ──
  gap(16)
  line("FROM", 9, false, GRAY)
  line(opts.fromName || "—", 14, true)
  line(`Fax: ${opts.fromNumber}`, 11)
  if (opts.contactInfo) {
    gap(4)
    for (const l of opts.contactInfo.split("\n").slice(0, 4)) line(l.trim(), 10)
  }

  // ── Subject ──
  if (opts.subject) {
    gap(16)
    line("SUBJECT", 9, false, GRAY)
    line(opts.subject, 13, true)
  }

  // ── Message ──
  if (opts.message) {
    gap(20)
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
    gap(12)
    line("MESSAGE", 9, false, GRAY)
    gap(6)
    for (const l of wrapText(opts.message, font, 11, contentWidth)) line(l, 11)
  }

  // ── Confidentiality notice — fixed block anchored at the bottom ──
  const noticeLines = wrapText(CONFIDENTIALITY_NOTICE, font, 8, contentWidth - 24)
  const noticeHeight = 24 + noticeLines.length * 11
  const boxTop = 46 + noticeHeight
  page.drawRectangle({
    x: margin, y: 46, width: contentWidth, height: noticeHeight,
    color: rgb(0.97, 0.97, 0.98), borderColor: rgb(0.85, 0.85, 0.88), borderWidth: 0.75,
  })
  page.drawText("CONFIDENTIALITY NOTICE", {
    x: margin + 12, y: boxTop - 16, font: bold, size: 8, color: GRAY,
  })
  let ny = boxTop - 28
  for (const l of noticeLines) {
    page.drawText(l, { x: margin + 12, y: ny, font, size: 8, color: rgb(0.3, 0.3, 0.3) })
    ny -= 11
  }

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
