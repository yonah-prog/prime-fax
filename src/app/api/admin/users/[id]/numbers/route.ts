import { db } from "@/lib/db"
import { phoneNumbers, userPhoneNumbers } from "@/lib/db/schema"
import { requireAdmin } from "@/lib/require-admin"
import { eq, and, asc } from "drizzle-orm"
import { NextResponse } from "next/server"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id: userId } = await params

  const allNumbers = await db.query.phoneNumbers.findMany({
    orderBy: [asc(phoneNumbers.createdAt)],
  })

  const assigned = await db.query.userPhoneNumbers.findMany({
    where: eq(userPhoneNumbers.userId, userId),
  })
  const assignedIds = new Set(assigned.map((r) => r.phoneNumberId))

  return NextResponse.json(
    allNumbers.map((n) => ({ ...n, hasAccess: assignedIds.has(n.id) }))
  )
}

export async function PUT(req: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id: userId } = await params
  const { phoneNumberId, access } = await req.json()

  if (!phoneNumberId) return NextResponse.json({ error: "phoneNumberId required" }, { status: 400 })

  if (access) {
    await db.insert(userPhoneNumbers).values({ userId, phoneNumberId }).onConflictDoNothing()
  } else {
    await db.delete(userPhoneNumbers).where(
      and(eq(userPhoneNumbers.userId, userId), eq(userPhoneNumbers.phoneNumberId, phoneNumberId))
    )
  }

  return NextResponse.json({ ok: true })
}
