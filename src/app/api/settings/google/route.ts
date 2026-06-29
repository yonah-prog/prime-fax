import { isGoogleConfigured } from "@/lib/google-drive"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"

// Google Drive is an admin-managed, account-level integration.
export async function GET() {
  const { session, error } = await requireAdmin()
  if (error) return error
  const userId = (session!.user as { id?: string }).id!

  if (!isGoogleConfigured()) {
    return NextResponse.json({ configured: false, connected: false })
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  return NextResponse.json({
    configured: true,
    connected: !!user?.googleRefreshToken,
    folder: user?.googleDriveFolder ?? "",
  })
}

export async function PATCH(req: Request) {
  const { session, error } = await requireAdmin()
  if (error) return error
  const userId = (session!.user as { id?: string }).id!

  const { folder } = await req.json().catch(() => ({}))
  await db.update(users)
    .set({ googleDriveFolder: typeof folder === "string" ? folder.trim() || null : null })
    .where(eq(users.id, userId))

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const { session, error } = await requireAdmin()
  if (error) return error
  const userId = (session!.user as { id?: string }).id!

  await db.update(users).set({
    googleAccessToken: null,
    googleRefreshToken: null,
    googleTokenExpiry: null,
  }).where(eq(users.id, userId))

  return NextResponse.json({ ok: true })
}
