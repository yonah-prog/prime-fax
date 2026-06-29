import { db } from "@/lib/db"
import { faxes } from "@/lib/db/schema"
import { getFaxAccess, canSeeFax } from "@/lib/fax-access"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getFaxAccess()
  if (!access.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const fax = await db.query.faxes.findFirst({ where: eq(faxes.id, id) })
  if (!fax || !canSeeFax(access, fax)) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(fax)
}
