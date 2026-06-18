import { db } from "@/lib/db"
import { groups, userGroups } from "@/lib/db/schema"
import { requireAdmin } from "@/lib/require-admin"
import { eq, asc, sql } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

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

export async function POST(req: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const { name, description } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 })

  try {
    const [group] = await db.insert(groups).values({ name: name.trim(), description: description?.trim() || null }).returning()
    return NextResponse.json({ ...group, memberCount: 0 }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "A group with that name already exists." }, { status: 409 })
  }
}
