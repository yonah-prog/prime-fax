import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { audit } from "@/lib/audit"
import { requireAdmin } from "@/lib/require-admin"
import { asc } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"
import { sendWelcomeEmail } from "@/lib/email"
import { randomBytes } from "crypto"

function generateTempPassword(): string {
  return "Temp-" + randomBytes(5).toString("hex")
}

export async function GET() {
  const { error, session } = await requireAdmin()
  if (error) return error

  const rows = await db.query.users.findMany({
    orderBy: [asc(users.createdAt)],
    columns: { passwordHash: false },
  })
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const { error, session } = await requireAdmin()
  if (error) return error

  const body = await req.json()
  const { name, email, role } = body

  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 })
  if (!email?.trim()) return NextResponse.json({ error: "Email is required" }, { status: 400 })

  const tempPassword = generateTempPassword()
  const passwordHash = await bcrypt.hash(tempPassword, 12)
  const userRole = role === "admin" ? "admin" : "staff"

  const [row] = await db
    .insert(users)
    .values({ name: name.trim(), email: email.trim().toLowerCase(), passwordHash, role: userRole })
    .onConflictDoNothing()
    .returning({ id: users.id, name: users.name, email: users.email, role: users.role, createdAt: users.createdAt })

  if (!row) return NextResponse.json({ error: "Email already exists" }, { status: 409 })

  audit({ userId: session!.user?.id, userEmail: session!.user?.email, action: "user_created", resourceType: "user", resourceId: row.id, meta: { email: row.email, role: userRole } })

  // Send welcome email with temp password (fire-and-forget)
  sendWelcomeEmail({ name: name.trim(), email: email.trim().toLowerCase(), tempPassword }).catch((e) => {
    console.error("Welcome email failed:", JSON.stringify(e?.response?.body ?? e?.message ?? e))
  })

  return NextResponse.json(row, { status: 201 })
}
