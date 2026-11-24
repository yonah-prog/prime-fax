import { db } from "@/lib/db"
import { faxes, phoneNumbers } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { downloadFaxFile } from "@/lib/storage"
import { validateServiceToken } from "@/lib/service-auth"

export const dynamic = "force-dynamic"

// Serves an inbound fax PDF to the referral intake module (server to server,
// service token only). Limited to inbound faxes received on intake-enabled
// lines, so the token cannot be used to read other faxes.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!validateServiceToken(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const fax = await db.query.faxes.findFirst({ where: eq(faxes.id, id) })
  if (!fax || fax.direction !== "inbound" || fax.trashedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const line = await db.query.phoneNumbers.findFirst({
    where: eq(phoneNumbers.number, fax.toNumber),
    columns: { intakeEnabled: true },
  })
  if (!line?.intakeEnabled) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!fax.fileUrl) return NextResponse.json({ error: "No file attached" }, { status: 404 })
  const buf = await downloadFaxFile(fax.fileUrl)
  if (!buf) return NextResponse.json({ error: "This fax file is no longer available." }, { status: 410 })

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="fax-${fax.id}.pdf"`,
      "Cache-Control": "no-store",
    },
  })
}
