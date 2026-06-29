import { db } from "@/lib/db"
import { faxes } from "@/lib/db/schema"
import { audit } from "@/lib/audit"
import { getFaxAccess, canSeeFax } from "@/lib/fax-access"
import { inArray } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const access = await getFaxAccess()
  if (!access.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { ids, action } = body as { ids: string[]; action: string }

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array is required" }, { status: 400 })
  }

  // All bulk actions here manage the trash bin / delete — require the privilege.
  if (!access.isAdmin && !access.canDelete) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 })
  }

  // Restrict to faxes the user is actually allowed to see.
  let allowedIds = ids
  if (!access.isAdmin) {
    const rows = await db.query.faxes.findMany({
      where: inArray(faxes.id, ids),
      columns: { id: true, direction: true, toNumber: true, userId: true },
    })
    allowedIds = rows.filter((f) => canSeeFax(access, f)).map((f) => f.id)
  }
  if (allowedIds.length === 0) return NextResponse.json({ ok: true, affected: 0 })

  if (action === "trash") {
    await db.update(faxes).set({ trashedAt: new Date(), updatedAt: new Date() }).where(inArray(faxes.id, allowedIds))
    audit({ userId: access.userId, userEmail: access.email, action: "fax_bulk_trashed", meta: { count: allowedIds.length } })
    return NextResponse.json({ ok: true, affected: allowedIds.length })
  }

  if (action === "restore") {
    await db.update(faxes).set({ trashedAt: null, updatedAt: new Date() }).where(inArray(faxes.id, allowedIds))
    audit({ userId: access.userId, userEmail: access.email, action: "fax_bulk_restored", meta: { count: allowedIds.length } })
    return NextResponse.json({ ok: true, affected: allowedIds.length })
  }

  if (action === "delete") {
    await db.delete(faxes).where(inArray(faxes.id, allowedIds))
    audit({ userId: access.userId, userEmail: access.email, action: "fax_bulk_deleted", meta: { count: allowedIds.length } })
    return NextResponse.json({ ok: true, affected: allowedIds.length })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
