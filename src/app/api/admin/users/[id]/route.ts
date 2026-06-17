import { auth } from "@/auth"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { audit } from "@/lib/audit"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  if (body.password !== undefined) {
    if (!body.password || body.password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }
    const passwordHash = await bcrypt.hash(body.password, 12)
    await db.update(users).set({ passwordHash }).where(eq(users.id, id))
    audit({ userId: session.user?.id, userEmail: session.user?.email, action: "password_reset", resourceType: "user", resourceId: id })
    return NextResponse.json({ ok: true })
  }

  if (body.role !== undefined) {
    const role = body.role === "admin" ? "admin" : "staff"
    await db.update(users).set({ role }).where(eq(users.id, id))
    audit({ userId: session.user?.id, userEmail: session.user?.email, action: "role_changed", resourceType: "user", resourceId: id, meta: { role } })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  if (id === session.user?.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 })
  }

  await db.delete(users).where(eq(users.id, id))
  audit({ userId: session.user?.id, userEmail: session.user?.email, action: "user_deleted", resourceType: "user", resourceId: id })
  return NextResponse.json({ ok: true })
}
