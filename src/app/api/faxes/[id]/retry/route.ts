import { auth } from "@/auth"
import { db } from "@/lib/db"
import { faxes } from "@/lib/db/schema"
import { sendFax } from "@/lib/telnyx"
import { audit } from "@/lib/audit"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const fax = await db.query.faxes.findFirst({ where: eq(faxes.id, id) })
  if (!fax) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (fax.status !== "failed") return NextResponse.json({ error: "Only failed faxes can be retried" }, { status: 400 })
  if (!fax.fileUrl) return NextResponse.json({ error: "No file to send" }, { status: 400 })

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/telnyx`

  await db.update(faxes)
    .set({ status: "queued", errorMessage: null, updatedAt: new Date() })
    .where(eq(faxes.id, id))

  try {
    const telnyxFax = await sendFax({ from: fax.fromNumber, to: fax.toNumber, mediaUrl: fax.fileUrl, webhookUrl })
    await db.update(faxes)
      .set({ telnyxFaxId: telnyxFax.id, status: "sending", updatedAt: new Date() })
      .where(eq(faxes.id, id))
    audit({ userId: session.user?.id, userEmail: session.user?.email, action: "fax_retried", resourceType: "fax", resourceId: id })
    return NextResponse.json({ ok: true, status: "sending" })
  } catch (err) {
    await db.update(faxes)
      .set({ status: "failed", errorMessage: String(err), updatedAt: new Date() })
      .where(eq(faxes.id, id))
    return NextResponse.json({ error: "Retry failed" }, { status: 500 })
  }
}
