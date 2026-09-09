import { db } from "@/lib/db"
import { faxes } from "@/lib/db/schema"
import { getFaxAccess, canSeeFax } from "@/lib/fax-access"
import { downloadFaxFile } from "@/lib/storage"
import { inArray } from "drizzle-orm"
import { zipSync } from "fflate"
import { NextResponse } from "next/server"

const MAX_FAXES = 200

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
  // Only files the user is allowed to see.
  const allowed = access.isAdmin ? rows : rows.filter((f) => canSeeFax(access, f))

  const files: Record<string, Uint8Array> = {}
  const used = new Set<string>()
  let ok = 0
  for (const f of allowed) {
    if (!f.fileUrl) continue
    const buf = await downloadFaxFile(f.fileUrl)
    if (!buf) continue
    // Human-readable, unique filename per fax.
    const who = (f.direction === "inbound" ? f.fromNumber : f.toNumber || "").replace(/[^\d+]/g, "") || "fax"
    const date = f.createdAt ? new Date(f.createdAt).toISOString().slice(0, 10) : "undated"
    let name = `${f.direction === "inbound" ? "from" : "to"}-${who}-${date}.pdf`
    let n = 2
    while (used.has(name)) name = `${f.direction === "inbound" ? "from" : "to"}-${who}-${date}-${n++}.pdf`
    used.add(name)
    files[name] = new Uint8Array(buf)
    ok++
  }

  if (ok === 0) {
    return NextResponse.json({ error: "None of the selected faxes have a downloadable file." }, { status: 404 })
  }

  const zip = zipSync(files, { level: 0 }) // PDFs are already compressed; store, don't re-deflate
  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="faxes-${stamp}.zip"`,
      "Cache-Control": "no-store",
    },
  })
}
