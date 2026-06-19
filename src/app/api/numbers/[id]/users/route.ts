import { db } from "@/lib/db"
import { users, userPhoneNumbers } from "@/lib/db/schema"
import { eq, and, asc } from "drizzle-orm"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"

type Params = { params: Promise<{ id: string }> }

// GET /api/numbers/[id]/users — all users with hasAccess flag
export async function GET(_req: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id: phoneNumberId } = await params

  const allUsers = await db.query.users.findMany({
    orderBy: [asc(users.name)],
    columns: { id: true, name: true, email: true, role: true },
  })

  const assigned = await db.query.userPhoneNumbers.findMany({
    where: eq(userPhoneNumbers.phoneNumberId, phoneNumberId),
  })
  const assignedIds = new Set(assigned.map((r) => r.userId))

  return NextResponse.json(
    allUsers.map((u) => ({ ...u, hasAccess: assignedIds.has(u.id) }))
  )
}

// PUT /api/numbers/[id]/users — body: { userId, access: boolean }
export async function PUT(req: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id: phoneNumberId } = await params
  const { userId, access } = await req.json()

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 })

  if (access) {
    await db
      .insert(userPhoneNumbers)
      .values({ userId, phoneNumberId })
      .onConflictDoNothing()
  } else {
    await db
      .delete(userPhoneNumbers)
      .where(
        and(
          eq(userPhoneNumbers.userId, userId),
          eq(userPhoneNumbers.phoneNumberId, phoneNumberId)
        )
      )
  }

  return NextResponse.json({ ok: true })
}
