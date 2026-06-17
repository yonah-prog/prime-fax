import { auth } from "@/auth"
import { db } from "@/lib/db"
import { phoneNumbers } from "@/lib/db/schema"
import { provisionNumber } from "@/lib/telnyx"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { phoneNumber, label } = body

  if (!phoneNumber) return NextResponse.json({ error: "phoneNumber is required" }, { status: 400 })

  const provisioned = await provisionNumber(phoneNumber)

  const existingCount = await db.query.phoneNumbers.findMany({ where: (t, { eq }) => eq(t.active, true) })
  const isDefault = existingCount.length === 0

  const [row] = await db
    .insert(phoneNumbers)
    .values({
      number: provisioned.phone_number,
      label: label?.trim() || null,
      telnyxNumberId: provisioned.id || null,
      isDefault,
    })
    .onConflictDoNothing()
    .returning()

  return NextResponse.json(row ?? { number: provisioned.phone_number }, { status: 201 })
}
