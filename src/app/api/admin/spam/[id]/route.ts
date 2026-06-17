import { auth } from "@/auth"
import { db } from "@/lib/db"
import { blockedNumbers } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  await db.delete(blockedNumbers).where(eq(blockedNumbers.id, id))
  return NextResponse.json({ ok: true })
}
