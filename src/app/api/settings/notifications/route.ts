import { auth } from "@/auth"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user?.id as string),
    columns: { notifyInbound: true, notifyEmail: true },
  })
  return NextResponse.json(user ?? {})
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { notifyInbound, notifyEmail } = await req.json()
  await db.update(users)
    .set({ notifyInbound: !!notifyInbound, notifyEmail: notifyEmail?.trim() || null })
    .where(eq(users.id, session.user?.id as string))

  return NextResponse.json({ ok: true })
}
