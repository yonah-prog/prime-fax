import { db } from "@/lib/db"
import { faxes } from "@/lib/db/schema"
import { notifyFaxReceived } from "@/lib/email"
import { requireAdmin } from "@/lib/require-admin"
import { eq, desc, isNotNull, like } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 })

  const r2Base = process.env.R2_PUBLIC_URL ?? ""

  // Prefer a fax stored in our own R2; fall back to any inbound with a fileUrl
  const fax = r2Base
    ? await db.query.faxes.findFirst({
        where: (f, { and }) => and(eq(f.direction, "inbound"), isNotNull(f.fileUrl), like(f.fileUrl, `${r2Base}%`)),
        orderBy: [desc(faxes.createdAt)],
      }) ?? await db.query.faxes.findFirst({
        where: (f, { and }) => and(eq(f.direction, "inbound"), isNotNull(f.fileUrl)),
        orderBy: [desc(faxes.createdAt)],
      })
    : await db.query.faxes.findFirst({
        where: (f, { and }) => and(eq(f.direction, "inbound"), isNotNull(f.fileUrl)),
        orderBy: [desc(faxes.createdAt)],
      })

  if (!fax) return NextResponse.json({ error: "No received faxes with a file found" }, { status: 404 })

  await notifyFaxReceived({
    fromNumber: fax.fromNumber,
    toNumber: fax.toNumber,
    pages: fax.pages,
    fileUrl: fax.fileUrl,
    overrideTo: email,
  })

  return NextResponse.json({ ok: true, faxId: fax.id, sentTo: email })
}
