import { db } from "@/lib/db"
import { faxes } from "@/lib/db/schema"
import { and, count, eq, isNull, inArray } from "drizzle-orm"
import { getFaxAccess } from "@/lib/fax-access"
import { NextResponse } from "next/server"

export async function GET() {
  const access = await getFaxAccess()
  if (!access.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Non-admins only count unread inbound for numbers they can see.
  if (!access.isAdmin && (!access.canViewInbound || access.numbers.length === 0)) {
    return NextResponse.json({ count: 0 })
  }

  const conds = [eq(faxes.direction, "inbound"), isNull(faxes.readAt), isNull(faxes.trashedAt)]
  if (!access.isAdmin) conds.push(inArray(faxes.toNumber, access.numbers))

  const [result] = await db.select({ value: count() }).from(faxes).where(and(...conds))

  return NextResponse.json({ count: result?.value ?? 0 })
}
