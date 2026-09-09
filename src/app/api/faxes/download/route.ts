import { db } from "@/lib/db"
import { faxes } from "@/lib/db/schema"
import { getFaxAccess, canSeeFax } from "@/lib/fax-access"
import { downloadFaxFile } from "@/lib/storage"
import { inArray } from "drizzle-orm"
import { zipSync } from "fflate"
import { NextResponse } from "next/server"

const MAX_FAXES = 1000
const CONCURRENCY = 12

// Date + 24h time (Eastern) for filenames — e.g. { date: "2026-09-09", time: "14-30-05" }.
function stamp(d: Date | null | undefined): { date: string; time: string } {
  if (!d) return { date: "undated", time: "00-00-00" }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(d))
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00"
  return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour")}-${g("minute")}-${g("second")}` }
}

// Bulk-download the selected faxes as a single .zip of PDFs. Reuses downloadFaxFile
// (credentialed R2 / plain HTTP) so it works regardless of where the file lives.
export async function POST(req: Request) {
  const access = await getFaxAccess()
  if (!access.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const ids = Array.isArray(body?.ids) ? (body.ids as string[]) : []
  if (ids.length === 0) return NextResponse.json({ error: "No faxes selected" }, { status: 400 })
  if (ids.length > MAX_FAXES) {
    return NextResponse.json({ error: `Too many faxes selected (max ${MAX_FAXES}). Narrow your selection.` }, { status: 400 })
  }

  const rows = await db.query.faxes.findMany({
    where: inArray(faxes.id, ids),
    columns: {
      id: true, direction: true, toNumber: true, fromNumber: true,
      fileUrl: true, fileName: true, createdAt: true, userId: true,
    },
  })
  // Only files the user is allowed to see. Newest first for stable ordering.
  const allowed = (access.isAdmin ? rows : rows.filter((f) => canSeeFax(access, f)))
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())

  // Fetch the PDFs in parallel (bounded concurrency) so large batches stay fast.
  const buffers = new Map<string, Uint8Array>()
  let cursor = 0
  async function worker() {
    while (cursor < allowed.length) {
      const f = allowed[cursor++]
      if (!f.fileUrl) continue
      const buf = await downloadFaxFile(f.fileUrl)
      if (buf) buffers.set(f.id, new Uint8Array(buf))
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, allowed.length) }, () => worker()))

  // Build human-readable, unique filenames in stable (newest-first) order.
  const files: Record<string, Uint8Array> = {}
  const used = new Set<string>()
  for (const f of allowed) {
    const buf = buffers.get(f.id)
    if (!buf) continue
    const who = (f.direction === "inbound" ? f.fromNumber : f.toNumber || "").replace(/[^\d+]/g, "") || "fax"
    const { date, time } = stamp(f.createdAt)
    // Filename leads with date, then time, then the other party's number.
    const base = `${date}_${time}-${f.direction === "inbound" ? "from" : "to"}-${who}`
    let name = `${base}.pdf`
    let n = 2
    while (used.has(name)) name = `${base}-${n++}.pdf`
    used.add(name)
    files[name] = buf
  }
  const ok = Object.keys(files).length

  if (ok === 0) {
    return NextResponse.json({ error: "None of the selected faxes have a downloadable file." }, { status: 404 })
  }

  const zip = zipSync(files, { level: 0 }) // PDFs are already compressed; store, don't re-deflate
  const today = new Date().toISOString().slice(0, 10)
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="faxes-${today}.zip"`,
      "Cache-Control": "no-store",
    },
  })
}
