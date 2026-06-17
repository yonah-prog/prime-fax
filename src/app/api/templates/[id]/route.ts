import { auth } from "@/auth"
import { db } from "@/lib/db"
import { coverSheetTemplates } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { name, fromName, coverSheetMessage, contactInfo, isDefault } = body

  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 })

  if (isDefault) {
    await db.update(coverSheetTemplates).set({ isDefault: false })
  }

  const [row] = await db
    .update(coverSheetTemplates)
    .set({ name: name.trim(), fromName, coverSheetMessage, contactInfo, isDefault: !!isDefault, updatedAt: new Date() })
    .where(eq(coverSheetTemplates.id, id))
    .returning()

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(row)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await db.delete(coverSheetTemplates).where(eq(coverSheetTemplates.id, id))
  return NextResponse.json({ ok: true })
}
