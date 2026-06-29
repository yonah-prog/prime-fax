import { db } from "@/lib/db"
import { faxes } from "@/lib/db/schema"
import { audit } from "@/lib/audit"
import { getFaxAccess, canSeeFax, type FaxAccess } from "@/lib/fax-access"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

// Loads a fax only if the current user is allowed to see it.
async function loadVisibleFax(id: string): Promise<
  | { status: 401; access: null; fax: null }
  | { status: 404; access: FaxAccess; fax: null }
  | { status: 200; access: FaxAccess; fax: NonNullable<Awaited<ReturnType<typeof db.query.faxes.findFirst>>> }
> {
  const access = await getFaxAccess()
  if (!access.userId) return { status: 401, access: null, fax: null }
  const fax = await db.query.faxes.findFirst({ where: eq(faxes.id, id) })
  if (!fax || !canSeeFax(access, fax)) return { status: 404, access, fax: null }
  return { status: 200, access, fax }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await loadVisibleFax(id)
  if (r.status !== 200) return NextResponse.json({ error: r.status === 401 ? "Unauthorized" : "Not found" }, { status: r.status })
  return NextResponse.json(r.fax)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await loadVisibleFax(id)
  if (r.status !== 200) return NextResponse.json({ error: r.status === 401 ? "Unauthorized" : "Not found" }, { status: r.status })
  const { access } = r

  const body = await req.json()
  const { action } = body

  if (action === "trash") {
    if (!access.isAdmin && !access.canDelete) return NextResponse.json({ error: "Not permitted" }, { status: 403 })
    await db.update(faxes).set({ trashedAt: new Date(), updatedAt: new Date() }).where(eq(faxes.id, id))
    audit({ userId: access.userId, userEmail: access.email, action: "fax_trashed", resourceType: "fax", resourceId: id })
    return NextResponse.json({ ok: true })
  }

  if (action === "restore") {
    if (!access.isAdmin && !access.canDelete) return NextResponse.json({ error: "Not permitted" }, { status: 403 })
    await db.update(faxes).set({ trashedAt: null, updatedAt: new Date() }).where(eq(faxes.id, id))
    audit({ userId: access.userId, userEmail: access.email, action: "fax_restored", resourceType: "fax", resourceId: id })
    return NextResponse.json({ ok: true })
  }

  if (action === "read") {
    await db.update(faxes).set({ readAt: new Date(), updatedAt: new Date() }).where(eq(faxes.id, id))
    return NextResponse.json({ ok: true })
  }

  if (action === "unread") {
    await db.update(faxes).set({ readAt: null, updatedAt: new Date() }).where(eq(faxes.id, id))
    return NextResponse.json({ ok: true })
  }

  if (action === "notes") {
    const { notes } = body
    await db.update(faxes).set({ notes: notes ?? null, updatedAt: new Date() }).where(eq(faxes.id, id))
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await loadVisibleFax(id)
  if (r.status !== 200) return NextResponse.json({ error: r.status === 401 ? "Unauthorized" : "Not found" }, { status: r.status })
  const { access } = r

  if (!access.isAdmin && !access.canDelete) return NextResponse.json({ error: "Not permitted" }, { status: 403 })

  await db.delete(faxes).where(eq(faxes.id, id))
  audit({ userId: access.userId, userEmail: access.email, action: "fax_deleted", resourceType: "fax", resourceId: id })
  return NextResponse.json({ ok: true })
}
