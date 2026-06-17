import { auth } from "@/auth"
import { db } from "@/lib/db"
import { phoneNumbers } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { releaseNumber } from "@/lib/telnyx"
import { NextResponse } from "next/server"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { label, isDefault } = body

  if (isDefault) {
    await db.update(phoneNumbers).set({ isDefault: false })
  }

  const [row] = await db
    .update(phoneNumbers)
    .set({ label: label?.trim() || null, ...(isDefault !== undefined ? { isDefault: !!isDefault } : {}) })
    .where(eq(phoneNumbers.id, id))
    .returning()

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(row)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const release = searchParams.get("release") === "true"

  const [row] = await db
    .update(phoneNumbers)
    .set({ active: false })
    .where(eq(phoneNumbers.id, id))
    .returning()

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (release && row.telnyxNumberId) {
    try {
      await releaseNumber(row.telnyxNumberId)
    } catch {
      // Log but don't fail — number is already deactivated locally
    }
  }

  return NextResponse.json({ ok: true })
}
