import { PDFDocument, StandardFonts, rgb, PDFFont, RGB } from "pdf-lib"
import { XMLParser } from "fast-xml-parser"

/**
 * Renders a Telerik Reporting TRDX (XML) cover-sheet definition to a PDF,
 * in-process, with no .NET/Telerik dependency.
 *
 * TRDX is the XML serialization of a Telerik report. For fax cover sheets the
 * layouts are simple — absolutely-positioned TextBoxes, lines, boxes, and the
 * occasional embedded image — so we interpret that subset directly with pdf-lib
 * rather than hosting the full Telerik engine.
 *
 * Telerik serializes style/geometry differently across versions (sometimes as
 * XML attributes, sometimes as child elements), so every accessor checks both.
 * Anything we can't confidently render is skipped; if parsing fails outright we
 * return null and the caller falls back to the generated cover sheet.
 */

export type TrdxParams = Record<string, string>

const POINTS_PER_INCH = 72
const POINTS_PER_CM = 28.3464567
const POINTS_PER_MM = 2.83464567
const POINTS_PER_PX = 0.75 // 96px = 72pt

// Telerik unit string -> PDF points. Accepts "1in", "2.5cm", "25mm", "96px",
// "12pt", or a bare number (assumed inches, Telerik's default serialization).
function toPoints(value: unknown, fallback = 0): number {
  if (typeof value === "number") return value * POINTS_PER_INCH
  if (typeof value !== "string") return fallback
  const m = value.trim().match(/^(-?[\d.]+)\s*(in|cm|mm|px|pt)?$/i)
  if (!m) return fallback
  const n = parseFloat(m[1])
  if (!isFinite(n)) return fallback
  switch ((m[2] || "in").toLowerCase()) {
    case "cm": return n * POINTS_PER_CM
    case "mm": return n * POINTS_PER_MM
    case "px": return n * POINTS_PER_PX
    case "pt": return n
    default: return n * POINTS_PER_INCH
  }
}

const NAMED_COLORS: Record<string, [number, number, number]> = {
  white: [255, 255, 255], black: [0, 0, 0], red: [255, 0, 0], green: [0, 128, 0],
  blue: [0, 0, 255], gray: [128, 128, 128], grey: [128, 128, 128],
  silver: [192, 192, 192], navy: [0, 0, 128], transparent: [255, 255, 255],
}

function parseColor(value: unknown): RGB | null {
  if (typeof value !== "string") return null
  const v = value.trim()
  if (!v || v.toLowerCase() === "transparent") return null
  const hex = v.match(/^#?([0-9a-f]{6})$/i)
  if (hex) {
    const int = parseInt(hex[1], 16)
    return rgb(((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255)
  }
  const triple = v.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/)
  if (triple) return rgb(+triple[1] / 255, +triple[2] / 255, +triple[3] / 255)
  const named = NAMED_COLORS[v.toLowerCase()]
  if (named) return rgb(named[0] / 255, named[1] / 255, named[2] / 255)
  return null
}

// Read a property that may live as an attribute (@_Name), a child element, or
// inside a nested <Style> element (as attribute or child).
function prop(node: Record<string, unknown> | undefined, name: string): unknown {
  if (!node) return undefined
  if (node[`@_${name}`] !== undefined) return node[`@_${name}`]
  if (node[name] !== undefined && typeof node[name] !== "object") return node[name]
  const style = node["Style"] as Record<string, unknown> | undefined
  if (style) {
    if (style[`@_${name}`] !== undefined) return style[`@_${name}`]
    if (style[name] !== undefined && typeof style[name] !== "object") return style[name]
  }
  return undefined
}

function fontInfo(node: Record<string, unknown>): { size: number; bold: boolean; italic: boolean } {
  const style = (node["Style"] as Record<string, unknown>) ?? node
  const font = (style["Font"] as Record<string, unknown>) ?? {}
  // Font size is almost always serialized in points (e.g. "16pt"); toPoints
  // handles the "pt" suffix and other units, defaulting to 11pt.
  const sizeRaw = prop(font, "Size") ?? prop(node, "Size")
  const size = toPoints(typeof sizeRaw === "string" && !/[a-z]/i.test(sizeRaw) ? `${sizeRaw}pt` : sizeRaw, 11)
  const bold = String(prop(font, "Bold") ?? prop(node, "Bold") ?? "").toLowerCase() === "true"
  const italic = String(prop(font, "Italic") ?? prop(node, "Italic") ?? "").toLowerCase() === "true"
  return { size: size > 0 ? size : 11, bold, italic }
}

// Resolve a TextBox Value expression against the supplied parameters.
// Handles: "=Parameters.name.Value", "=Parameters.name", "=Fields.x",
// '= "literal"', "= 'literal'", and plain static text.
function resolveValue(raw: unknown, params: TrdxParams): string {
  if (raw == null) return ""
  let s = String(raw)
  if (!s.startsWith("=")) return s
  s = s.slice(1).trim()

  // Pure quoted literal
  const lit = s.match(/^"([^"]*)"$/) || s.match(/^'([^']*)'$/)
  if (lit) return lit[1]

  // Substitute Parameters.x(.Value) and Fields.x references; concatenations
  // joined with + are flattened, quoted literals preserved.
  const withParams = s.replace(/Parameters\.([A-Za-z0-9_]+)(?:\.Value)?/g, (_, n) => params[n] ?? "")
  const withFields = withParams.replace(/Fields\.([A-Za-z0-9_]+)/g, (_, n) => params[n] ?? "")
  // Strip remaining quotes and + concatenation operators
  const flattened = withFields
    .split("+")
    .map((part) => part.trim().replace(/^["']|["']$/g, ""))
    .join("")
  return flattened
}

function stripHtml(s: string): string {
  return s.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim()
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return []
  return Array.isArray(v) ? v : [v]
}

// Collect the report items inside a section's <Items> wrapper. Item element
// names (TextBox, HtmlTextBox, PictureBox, Line, Shape, PanelBox, …) become
// object keys, each holding one item or an array of items.
function collectItems(itemsNode: Record<string, unknown> | undefined): { type: string; node: Record<string, unknown> }[] {
  const out: { type: string; node: Record<string, unknown> }[] = []
  if (!itemsNode) return out
  for (const [type, val] of Object.entries(itemsNode)) {
    if (type.startsWith("@_")) continue
    for (const node of asArray(val as Record<string, unknown> | Record<string, unknown>[])) {
      if (node && typeof node === "object") out.push({ type, node })
    }
  }
  return out
}

const SECTION_KEYS = [
  "ReportHeaderSection", "PageHeaderSection", "GroupHeaderSection",
  "DetailSection", "GroupFooterSection", "ReportFooterSection", "PageFooterSection",
]

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split("\n")) {
    if (!paragraph) { lines.push(""); continue }
    let cur = ""
    for (const word of paragraph.split(/\s+/)) {
      const test = cur ? `${cur} ${word}` : word
      let w = 0
      try { w = font.widthOfTextAtSize(test, size) } catch { w = test.length * size * 0.5 }
      if (w > maxWidth && cur) { lines.push(cur); cur = word } else { cur = test }
    }
    if (cur) lines.push(cur)
  }
  return lines
}

// Drop characters StandardFonts (WinAnsi) can't encode so drawText never throws.
function winAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[‘’‚‛]/g, "'").replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, "-").replace(/…/g, "...")
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "")
}

export async function renderTrdxToPdf(xml: string, params: TrdxParams): Promise<Uint8Array | null> {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      removeNSPrefix: true,
      parseAttributeValue: false,
      trimValues: true,
    })
    const parsed = parser.parse(xml) as Record<string, unknown>
    const report = parsed["Report"] as Record<string, unknown> | undefined
    if (!report) return null

    // Page geometry
    const pageSettings = (report["PageSettings"] as Record<string, unknown>) ?? {}
    const margins = (pageSettings["Margins"] as Record<string, unknown>) ?? (pageSettings["MarginsU"] as Record<string, unknown>) ?? {}
    const marginLeft = toPoints(prop(margins, "Left"), 0.5 * POINTS_PER_INCH)
    const marginTop = toPoints(prop(margins, "Top"), 0.5 * POINTS_PER_INCH)

    const paper = String(prop(pageSettings, "PaperKind") ?? prop(pageSettings, "PaperSize") ?? "Letter").toLowerCase()
    let pageW = 612, pageH = 792 // Letter default
    if (paper.includes("legal")) { pageW = 612; pageH = 1008 }
    else if (paper.includes("a4")) { pageW = 595.28; pageH = 841.89 }

    const doc = await PDFDocument.create()
    const page = doc.addPage([pageW, pageH])
    const regular = await doc.embedFont(StandardFonts.Helvetica)
    const bold = await doc.embedFont(StandardFonts.HelveticaBold)
    const oblique = await doc.embedFont(StandardFonts.HelveticaOblique)
    const boldOblique = await doc.embedFont(StandardFonts.HelveticaBoldOblique)
    const pickFont = (b: boolean, i: boolean) => (b && i ? boldOblique : b ? bold : i ? oblique : regular)

    const reportItems = (report["Items"] as Record<string, unknown>) ?? {}
    const sections: Record<string, unknown>[] = []
    for (const key of SECTION_KEYS) {
      for (const sec of asArray(reportItems[key] as Record<string, unknown> | Record<string, unknown>[])) {
        if (sec && typeof sec === "object") sections.push(sec)
      }
    }
    if (sections.length === 0) return null

    let drewSomething = false
    let sectionTop = marginTop // running offset from page top

    for (const section of sections) {
      const sectionHeight = toPoints(prop(section, "Height"), 0)
      const items = collectItems(section["Items"] as Record<string, unknown> | undefined)

      for (const { type, node } of items) {
        const left = marginLeft + toPoints(prop(node, "Left"), 0)
        const top = sectionTop + toPoints(prop(node, "Top"), 0)
        const width = toPoints(prop(node, "Width"), 100)
        const height = toPoints(prop(node, "Height"), 14)

        // Background fill (boxes, panels, filled textboxes)
        const bg = parseColor(prop(node, "BackgroundColor"))
        if (bg && (type === "PanelBox" || type === "Shape" || type === "TextBox" || type === "HtmlTextBox")) {
          page.drawRectangle({ x: left, y: pageH - top - height, width, height, color: bg })
          drewSomething = true
        }

        if (type === "Line") {
          const color = parseColor(prop(node, "Color")) ?? rgb(0, 0, 0)
          const thickness = toPoints(prop(node, "Size") ?? prop(node, "LineWidth"), 0.5) || 0.5
          // Horizontal or vertical based on width/height
          const y = pageH - top - height / 2
          page.drawLine({ start: { x: left, y }, end: { x: left + width, y }, thickness, color })
          drewSomething = true
          continue
        }

        if (type === "PictureBox") {
          const val = String(prop(node, "Value") ?? "")
          const b64 = val.match(/base64,([A-Za-z0-9+/=]+)/)?.[1] ?? (/^[A-Za-z0-9+/=]+$/.test(val) && val.length > 100 ? val : null)
          if (b64) {
            try {
              const bytes = Buffer.from(b64, "base64")
              const mime = String(prop(node, "MimeType") ?? "").toLowerCase()
              const img = mime.includes("png") || !mime ? await doc.embedPng(bytes).catch(() => null) : await doc.embedJpg(bytes).catch(() => null)
              if (img) { page.drawImage(img, { x: left, y: pageH - top - height, width, height }); drewSomething = true }
            } catch { /* skip image */ }
          }
          continue
        }

        if (type === "TextBox" || type === "HtmlTextBox") {
          let text = resolveValue(prop(node, "Value"), params)
          if (type === "HtmlTextBox") text = stripHtml(text)
          text = winAnsi(text)
          if (!text) continue

          const { size, bold: isB, italic: isI } = fontInfo(node)
          const font = pickFont(isB, isI)
          const color = parseColor(prop(node, "Color")) ?? rgb(0, 0, 0)
          const align = String(prop(node, "TextAlign") ?? "Left").toLowerCase()

          const lines = wrapText(text, font, size, Math.max(width, 20))
          let lineY = pageH - top - size // baseline of first line
          for (const ln of lines) {
            if (lineY < 0) break
            let x = left
            if (align === "center" || align === "right") {
              let w = 0
              try { w = font.widthOfTextAtSize(ln, size) } catch { w = ln.length * size * 0.5 }
              x = align === "center" ? left + (width - w) / 2 : left + width - w
            }
            page.drawText(ln, { x, y: lineY, size, font, color })
            lineY -= size * 1.2
          }
          drewSomething = true
        }
      }

      sectionTop += sectionHeight
    }

    if (!drewSomething) return null
    return await doc.save()
  } catch {
    return null
  }
}
