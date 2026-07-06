import { auth } from "@/auth"
import { db } from "@/lib/db"
import { phoneNumbers } from "@/lib/db/schema"
import { eq, desc, sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rows = await db
    .select({
      id: phoneNumbers.id,
      number: phoneNumbers.number,
      label: phoneNumbers.label,
      deptName: phoneNumbers.deptName,
      telnyxNumberId: phoneNumbers.telnyxNumberId,
      active: phoneNumbers.active,
      isDefault: phoneNumbers.isDefault,
      coverSheetTemplateId: phoneNumbers.coverSheetTemplateId,
      inboundDriveFolder: phoneNumbers.inboundDriveFolder,
      forwardToNumber: phoneNumbers.forwardToNumber,
      notifyEmail: phoneNumbers.notifyEmail,
      createdAt: phoneNumbers.createdAt,
      numUsersAssigned: sql<number>`(SELECT COUNT(*) FROM users WHERE users.assigned_number_id = ${phoneNumbers.id})::int`,
      numUsersCanAccess: sql<number>`(SELECT COUNT(*) FROM user_phone_numbers WHERE user_phone_numbers.phone_number_id = ${phoneNumbers.id})::int`,
    })
    .from(phoneNumbers)
    .where(eq(phoneNumbers.active, true))
    .orderBy(desc(phoneNumbers.isDefault), desc(phoneNumbers.createdAt))
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const body = await req.json()
  const { number, label, telnyxNumberId, isDefault } = body

  if (!number?.trim()) return NextResponse.json({ error: "Number is required" }, { status: 400 })

  if (isDefault) {
    await db.update(phoneNumbers).set({ isDefault: false })
  }

  const [row] = await db
    .insert(phoneNumbers)
    .values({ number: number.trim(), label: label?.trim() || null, telnyxNumberId: telnyxNumberId || null, isDefault: !!isDefault })
    .onConflictDoNothing()
    .returning()

  if (!row) return NextResponse.json({ error: "Number already exists" }, { status: 409 })
  return NextResponse.json(row, { status: 201 })
}
