import { auth } from "@/auth"
import { db } from "@/lib/db"
import { phoneNumbers } from "@/lib/db/schema"
import { desc } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rows = await db.query.phoneNumbers.findMany({
    where: (t, { eq }) => eq(t.active, true),
    orderBy: [desc(phoneNumbers.isDefault), desc(phoneNumbers.createdAt)],
  })
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { number, label, telnyxNumberId, isDefault } = body

  if (!number?.trim()) return NextResponse.json({ error: "Number is required" }, { status: 400 })

  if (isDefault) {
    await db.update(phoneNumbers).set({ isDefault: false })
  }

  const [row] = await db
    .insert(phoneNumbers)
    .values({ number: number.trim(), label: label?.trim() || null, telnyxNumberId: telnyxNumberId || null, isDefault: !!isDefault })
    .onConflictDoNothing()
    .returning()

  if (!row) return NextResponse.json({ error: "Number already exists" }, { status: 409 })
  return NextResponse.json(row, { status: 201 })
}
