import { auth } from "@/auth"
import { db } from "@/lib/db"
import { faxes } from "@/lib/db/schema"
import { and, count, eq, isNull } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [result] = await db
    .select({ value: count() })
    .from(faxes)
    .where(and(eq(faxes.direction, "inbound"), isNull(faxes.readAt), isNull(faxes.trashedAt)))

  return NextResponse.json({ count: result?.value ?? 0 })
}
