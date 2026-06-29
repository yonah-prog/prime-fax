import { db } from "@/lib/db"
import { faxes } from "@/lib/db/schema"
import { and, eq, or, desc, sql, inArray } from "drizzle-orm"
import { getFaxAccess } from "@/lib/fax-access"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const access = await getFaxAccess()
  if (!access.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const direction = searchParams.get("direction") as "inbound" | "outbound" | null

  const conds = []
  if (direction === "inbound" || direction === "outbound") conds.push(eq(faxes.direction, direction))

  // Per-user access scoping
  if (!access.isAdmin) {
    const inboundVisible = access.canViewInbound && access.numbers.length > 0
      ? and(eq(faxes.direction, "inbound"), inArray(faxes.toNumber, access.numbers))
      : sql`false`
    const outboundVisible = access.canViewAllSent
      ? eq(faxes.direction, "outbound")
      : and(eq(faxes.direction, "outbound"), eq(faxes.userId, access.userId))
    conds.push(or(inboundVisible, outboundVisible)!)
  }

  const rows = await db.query.faxes.findMany({
    where: conds.length ? and(...conds) : undefined,
    orderBy: [desc(faxes.createdAt)],
    limit: 100,
  })

  return NextResponse.json(rows)
}
