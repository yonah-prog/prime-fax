import { auth } from "@/auth"
import { db } from "@/lib/db"
import { coverSheetTemplates } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rows = await db.query.coverSheetTemplates.findMany({
    orderBy: [desc(coverSheetTemplates.isDefault), desc(coverSheetTemplates.createdAt)],
  })
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { name, fromName, coverSheetMessage, contactInfo, isDefault } = body

  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 })

  if (isDefault) {
    await db.update(coverSheetTemplates).set({ isDefault: false })
  }

  const [row] = await db
    .insert(coverSheetTemplates)
    .values({ name: name.trim(), fromName, coverSheetMessage, contactInfo, isDefault: !!isDefault })
    .returning()

  return NextResponse.json(row, { status: 201 })
}
