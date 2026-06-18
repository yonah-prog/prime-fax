import { auth } from "@/auth"
import { db } from "@/lib/db"
import { groups, userGroups } from "@/lib/db/schema"
import { eq, asc, sql } from "drizzle-orm"
import { NextResponse } from "next/server"

// GET /api/admin/groups — list all groups with member count
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      description: groups.description,
      createdAt: groups.createdAt,
      updatedAt: groups.updatedAt,
      memberCount: sql<number>`count(${userGroups.id})::int`,
    })
    .from(groups)
    .leftJoin(userGroups, eq(userGroups.groupId, groups.id))
    .groupBy(groups.id)
    .orderBy(asc(groups.name))

  return NextResponse.json(rows)
}

// POST /api/admin/groups — create group
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, description } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 })

  try {
    const [group] = await db.insert(groups).values({ name: name.trim(), description: description?.trim() || null }).returning()
    return NextResponse.json({ ...group, memberCount: 0 }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "A group with that name already exists." }, { status: 409 })
  }
}
