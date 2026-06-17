import { db } from "@/lib/db"
import { faxes, blockedNumbers } from "@/lib/db/schema"
import { uploadToR2 } from "@/lib/storage"
import { notifyFaxReceived } from "@/lib/email"
import { verifyTelnyxWebhook } from "@/lib/telnyx-verify"
import { uploadToDriveForAll } from "@/lib/google-drive"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { randomUUID } from "crypto"

export async function POST(req: Request) {
  const rawBody = await req.text()

  const sig = req.headers.get("telnyx-signature-ed25519")
  const ts = req.headers.get("telnyx-timestamp")
  if (!verifyTelnyxWebhook(rawBody, sig, ts)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let body: { data?: { event_type?: string; payload?: Record<string, unknown> } }
  try { body = JSON.parse(rawBody) } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }) }

  const { event_type, payload } = body?.data ?? {}
  if (!event_type || !payload) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })

  if (event_type === "fax.delivered") {
    await db
      .update(faxes)
      .set({ status: "delivered", pages: (payload.page_count as number) ?? null, updatedAt: new Date() })
      .where(eq(faxes.telnyxFaxId, payload.fax_id as string))
  }

  if (event_type === "fax.send.failed" || event_type === "fax.failed") {
    await db
      .update(faxes)
      .set({ status: "failed", errorMessage: (payload.failure_reason as string) ?? "Unknown error", updatedAt: new Date() })
      .where(eq(faxes.telnyxFaxId, payload.fax_id as string))
  }

  if (event_type === "fax.received") {
    const fromNumber = (payload.from as string) ?? "Unknown"

    // Spam check — silently drop if sender is blocked
    const blocked = await db.query.blockedNumbers.findFirst({
      where: eq(blockedNumbers.number, fromNumber),
    })
    if (blocked) return NextResponse.json({ ok: true })

    let fileUrl = payload.media_url as string | undefined

    // Re-host fax media on R2 for permanent storage; also upload to Google Drive
    if (fileUrl) {
      try {
        const res = await fetch(fileUrl, {
          headers: { Authorization: `Bearer ${process.env.TELNYX_API_KEY}` },
        })
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer())
          const contentType = res.headers.get("content-type") ?? "application/pdf"
          fileUrl = await uploadToR2(buffer, `inbound/${randomUUID()}.pdf`, contentType)
          const driveFileName = `Inbound-${fromNumber}-${new Date().toISOString().slice(0, 10)}.pdf`
          uploadToDriveForAll(buffer, driveFileName, contentType).catch(() => {})
        }
      } catch {
        // Keep Telnyx URL as fallback
      }
    }

    const toNumber = (payload.to as string) ?? process.env.TELNYX_FROM_NUMBER!
    const pageCount = (payload.page_count as number) ?? null

    await db.insert(faxes).values({
      direction: "inbound",
      status: "received",
      fromNumber,
      toNumber,
      telnyxFaxId: payload.fax_id as string,
      fileUrl,
      pages: pageCount,
    })

    // Email notification (fire-and-forget)
    notifyFaxReceived({ fromNumber, toNumber, pages: pageCount, fileUrl: fileUrl ?? null }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
