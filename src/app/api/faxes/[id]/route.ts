import { auth } from "@/auth"
import { db } from "@/lib/db"
import { faxes } from "@/lib/db/schema"
import { audit } from "@/lib/audit"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const fax = await db.query.faxes.findFirst({ where: eq(faxes.id, id) })
  if (!fax) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(fax)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { action } = body

  if (action === "trash") {
    await db.update(faxes).set({ trashedAt: new Date(), updatedAt: new Date() }).where(eq(faxes.id, id))
    audit({ userId: session.user?.id, userEmail: session.user?.email, action: "fax_trashed", resourceType: "fax", resourceId: id })
    return NextResponse.json({ ok: true })
  }

  if (action === "restore") {
    await db.update(faxes).set({ trashedAt: null, updatedAt: new Date() }).where(eq(faxes.id, id))
    audit({ userId: session.user?.id, userEmail: session.user?.email, action: "fax_restored", resourceType: "fax", resourceId: id })
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
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await db.delete(faxes).where(eq(faxes.id, id))
  audit({ userId: session.user?.id, userEmail: session.user?.email, action: "fax_deleted", resourceType: "fax", resourceId: id })
  return NextResponse.json({ ok: true })
}
