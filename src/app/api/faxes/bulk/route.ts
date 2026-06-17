import { auth } from "@/auth"
import { db } from "@/lib/db"
import { faxes } from "@/lib/db/schema"
import { audit } from "@/lib/audit"
import { eq, inArray } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { ids, action } = body as { ids: string[]; action: string }

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array is required" }, { status: 400 })
  }

  if (action === "trash") {
    await db.update(faxes).set({ trashedAt: new Date(), updatedAt: new Date() }).where(inArray(faxes.id, ids))
    audit({ userId: session.user?.id, userEmail: session.user?.email, action: "fax_bulk_trashed", meta: { count: ids.length } })
    return NextResponse.json({ ok: true })
  }

  if (action === "restore") {
    await db.update(faxes).set({ trashedAt: null, updatedAt: new Date() }).where(inArray(faxes.id, ids))
    audit({ userId: session.user?.id, userEmail: session.user?.email, action: "fax_bulk_restored", meta: { count: ids.length } })
    return NextResponse.json({ ok: true })
  }

  if (action === "delete") {
    await db.delete(faxes).where(inArray(faxes.id, ids))
    audit({ userId: session.user?.id, userEmail: session.user?.email, action: "fax_bulk_deleted", meta: { count: ids.length } })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
