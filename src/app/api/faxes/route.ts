import { auth } from "@/auth"
import { db } from "@/lib/db"
import { faxes } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const direction = searchParams.get("direction") as "inbound" | "outbound" | null

  const rows = await db.query.faxes.findMany({
    where: direction ? eq(faxes.direction, direction) : undefined,
    orderBy: [desc(faxes.createdAt)],
    limit: 100,
  })

  return NextResponse.json(rows)
}
