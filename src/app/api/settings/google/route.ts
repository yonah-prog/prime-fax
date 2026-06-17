import { auth } from "@/auth"
import { isGoogleConfigured } from "@/lib/google-drive"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!isGoogleConfigured()) {
    return NextResponse.json({ configured: false, connected: false })
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) })
  return NextResponse.json({
    configured: true,
    connected: !!user?.googleRefreshToken,
    folder: user?.googleDriveFolder ?? "",
  })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { folder } = await req.json().catch(() => ({}))
  await db.update(users)
    .set({ googleDriveFolder: typeof folder === "string" ? folder.trim() || null : null })
    .where(eq(users.id, session.user.id))

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await db.update(users).set({
    googleAccessToken: null,
    googleRefreshToken: null,
    googleTokenExpiry: null,
  }).where(eq(users.id, session.user.id))

  return NextResponse.json({ ok: true })
}
