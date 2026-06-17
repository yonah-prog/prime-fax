import { auth } from "@/auth"
import { db } from "@/lib/db"
import { contacts } from "@/lib/db/schema"
import { asc } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rows = await db.query.contacts.findMany({
    orderBy: [asc(contacts.name)],
  })
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { name, faxNumber, company, notes } = body

  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 })
  if (!faxNumber?.trim()) return NextResponse.json({ error: "Fax number is required" }, { status: 400 })

  const [row] = await db
    .insert(contacts)
    .values({ name: name.trim(), faxNumber: faxNumber.trim(), company: company?.trim() || null, notes: notes?.trim() || null })
    .returning()

  return NextResponse.json(row, { status: 201 })
}
