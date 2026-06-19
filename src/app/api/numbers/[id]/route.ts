import { db } from "@/lib/db"
import { phoneNumbers } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { releaseNumber } from "@/lib/telnyx"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const body = await req.json()
  const { label, isDefault, deptName, callerIdStatus, coverSheetTemplateId } = body

  if (isDefault) {
    await db.update(phoneNumbers).set({ isDefault: false })
  }

  const set: Record<string, unknown> = {}
  if (label !== undefined) set.label = label?.trim() || null
  if (isDefault !== undefined) set.isDefault = !!isDefault
  if (deptName !== undefined) set.deptName = deptName?.trim() || null
  if (callerIdStatus !== undefined) set.callerIdStatus = callerIdStatus
  if (coverSheetTemplateId !== undefined) set.coverSheetTemplateId = coverSheetTemplateId || null

  const [row] = await db
    .update(phoneNumbers)
    .set(set)
    .where(eq(phoneNumbers.id, id))
    .returning()

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(row)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin()
  if (error) return error

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
