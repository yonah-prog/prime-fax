import { db } from "@/lib/db"
import { blockedNumbers } from "@/lib/db/schema"
import { requireAdmin } from "@/lib/require-admin"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  await db.delete(blockedNumbers).where(eq(blockedNumbers.id, id))
  return NextResponse.json({ ok: true })
}
