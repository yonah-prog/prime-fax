import { auth } from "@/auth"
import { db } from "@/lib/db"
import { faxes } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const fax = await db.query.faxes.findFirst({ where: eq(faxes.id, id) })
  if (!fax) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(fax)
}
