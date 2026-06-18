import { auth } from "@/auth"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) })
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({
    name: user.name,
    email: user.email,
    timezone: user.timezone,
    defaultPage: user.defaultPage,
    markAsRead: user.markAsRead,
    downloadFormat: user.downloadFormat,
    defaultPageSize: user.defaultPageSize,
    defaultResolution: user.defaultResolution,
    secureMode: user.secureMode,
    require2FA: user.require2FA,
    assignedNumberId: user.assignedNumberId,
  })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Name must be a non-empty string" }, { status: 400 })
    }
  }

  const set: Record<string, unknown> = {}
  if (body.name !== undefined) set.name = body.name.trim()
  if (body.timezone !== undefined) set.timezone = body.timezone
  if (body.defaultPage !== undefined) set.defaultPage = body.defaultPage
  if (body.markAsRead !== undefined) set.markAsRead = body.markAsRead
  if (body.downloadFormat !== undefined) set.downloadFormat = body.downloadFormat
  if (body.defaultPageSize !== undefined) set.defaultPageSize = body.defaultPageSize
  if (body.defaultResolution !== undefined) set.defaultResolution = body.defaultResolution
  if (body.secureMode !== undefined) set.secureMode = !!body.secureMode
  if (body.require2FA !== undefined) set.require2FA = !!body.require2FA
  if (body.assignedNumberId !== undefined) set.assignedNumberId = body.assignedNumberId

  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  await db.update(users).set(set).where(eq(users.id, session.user.id))
  return NextResponse.json({ ok: true })
}
