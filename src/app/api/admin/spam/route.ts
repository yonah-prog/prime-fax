import { db } from "@/lib/db"
import { blockedNumbers } from "@/lib/db/schema"
import { requireAdmin } from "@/lib/require-admin"
import { desc } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  const rows = await db.query.blockedNumbers.findMany({ orderBy: [desc(blockedNumbers.createdAt)] })
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const body = await req.json()
  const { number, reason } = body
  if (!number?.trim()) return NextResponse.json({ error: "Number is required" }, { status: 400 })

  const [row] = await db
    .insert(blockedNumbers)
    .values({ number: number.trim(), reason: reason?.trim() || null })
    .onConflictDoNothing()
    .returning()

  if (!row) return NextResponse.json({ error: "Number already blocked" }, { status: 409 })
  return NextResponse.json(row, { status: 201 })
}
