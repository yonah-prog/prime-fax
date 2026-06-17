import { auth } from "@/auth"
import { db } from "@/lib/db"
import { contacts } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { name, faxNumber, company, notes } = body

  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 })
  if (!faxNumber?.trim()) return NextResponse.json({ error: "Fax number is required" }, { status: 400 })

  const [row] = await db
    .update(contacts)
    .set({ name: name.trim(), faxNumber: faxNumber.trim(), company: company?.trim() || null, notes: notes?.trim() || null, updatedAt: new Date() })
    .where(eq(contacts.id, id))
    .returning()

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(row)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await db.delete(contacts).where(eq(contacts.id, id))
  return NextResponse.json({ ok: true })
}
