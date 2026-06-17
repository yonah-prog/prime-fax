import { auth } from "@/auth"
import { db } from "@/lib/db"
import { faxes } from "@/lib/db/schema"
import { and, count, eq, gte, inArray, isNull } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [sentToday, receivedToday, failedToday, inProgress, recentActivity] = await Promise.all([
    db.select({ value: count() }).from(faxes).where(
      and(eq(faxes.direction, "outbound"), gte(faxes.createdAt, todayStart), isNull(faxes.trashedAt))
    ),
    db.select({ value: count() }).from(faxes).where(
      and(eq(faxes.direction, "inbound"), gte(faxes.createdAt, todayStart), isNull(faxes.trashedAt))
    ),
    db.select({ value: count() }).from(faxes).where(
      and(eq(faxes.status, "failed"), gte(faxes.createdAt, todayStart))
    ),
    db.select({ value: count() }).from(faxes).where(
      and(inArray(faxes.status, ["queued", "sending"]), isNull(faxes.trashedAt))
    ),
    db.query.faxes.findMany({
      where: isNull(faxes.trashedAt),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      limit: 8,
      columns: { id: true, direction: true, status: true, fromNumber: true, toNumber: true, pages: true, subject: true, createdAt: true },
    }),
  ])

  return NextResponse.json({
    sentToday: sentToday[0]?.value ?? 0,
    receivedToday: receivedToday[0]?.value ?? 0,
    failedToday: failedToday[0]?.value ?? 0,
    inProgress: inProgress[0]?.value ?? 0,
    recentActivity,
  })
}
