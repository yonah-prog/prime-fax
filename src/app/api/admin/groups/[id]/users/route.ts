import { auth } from "@/auth"
import { db } from "@/lib/db"
import { users, userGroups } from "@/lib/db/schema"
import { eq, and, asc } from "drizzle-orm"
import { NextResponse } from "next/server"

type Params = { params: Promise<{ id: string }> }

// GET /api/admin/groups/[id]/users — all users with inGroup flag
export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: groupId } = await params

  const allUsers = await db.query.users.findMany({
    orderBy: [asc(users.name)],
    columns: { id: true, name: true, email: true, role: true },
  })

  const members = await db.query.userGroups.findMany({
    where: eq(userGroups.groupId, groupId),
  })
  const memberIds = new Set(members.map((r) => r.userId))

  return NextResponse.json(allUsers.map((u) => ({ ...u, inGroup: memberIds.has(u.id) })))
}

// PUT /api/admin/groups/[id]/users — body: { userId, inGroup: boolean }
export async function PUT(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: groupId } = await params
  const { userId, inGroup } = await req.json()

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 })

  if (inGroup) {
    await db.insert(userGroups).values({ userId, groupId }).onConflictDoNothing()
  } else {
    await db.delete(userGroups).where(
      and(eq(userGroups.userId, userId), eq(userGroups.groupId, groupId))
    )
  }

  return NextResponse.json({ ok: true })
}
