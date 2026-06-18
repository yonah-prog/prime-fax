import { auth } from "@/auth"
import { db } from "@/lib/db"
import { groups } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

type Params = { params: Promise<{ id: string }> }

// PATCH /api/admin/groups/[id] — rename / update description
export async function PATCH(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { name, description } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 })

  try {
    const [group] = await db
      .update(groups)
      .set({ name: name.trim(), description: description?.trim() ?? null, updatedAt: new Date() })
      .where(eq(groups.id, id))
      .returning()
    return NextResponse.json(group)
  } catch {
    return NextResponse.json({ error: "A group with that name already exists." }, { status: 409 })
  }
}

// DELETE /api/admin/groups/[id]
export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await db.delete(groups).where(eq(groups.id, id))
  return NextResponse.json({ ok: true })
}
