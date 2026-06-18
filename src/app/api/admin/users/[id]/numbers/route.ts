import { auth } from "@/auth"
import { db } from "@/lib/db"
import { phoneNumbers, userPhoneNumbers } from "@/lib/db/schema"
import { eq, and, asc } from "drizzle-orm"
import { NextResponse } from "next/server"

type Params = { params: Promise<{ id: string }> }

// GET /api/admin/users/[id]/numbers — all numbers with hasAccess flag for this user
export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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

// PUT /api/admin/users/[id]/numbers — body: { phoneNumberId, access: boolean }
export async function PUT(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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
