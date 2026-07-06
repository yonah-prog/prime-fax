import { db } from "@/lib/db"
import { faxes, blockedNumbers, phoneNumbers } from "@/lib/db/schema"
import { uploadToR2 } from "@/lib/storage"
import { notifyFaxReceived } from "@/lib/email"
import { verifyTelnyxWebhook } from "@/lib/telnyx-verify"
import { uploadToDriveForAll } from "@/lib/google-drive"
import { sendFax } from "@/lib/telnyx"
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

  const faxId = typeof payload.fax_id === "string" ? payload.fax_id : null

  if (event_type === "fax.delivered" && faxId) {
    await db
      .update(faxes)
      .set({ status: "delivered", pages: (payload.page_count as number) ?? null, updatedAt: new Date() })
      .where(eq(faxes.telnyxFaxId, faxId))
  }

  if ((event_type === "fax.send.failed" || event_type === "fax.failed") && faxId) {
    await db
      .update(faxes)
      .set({ status: "failed", errorMessage: (payload.failure_reason as string) ?? "Unknown error", updatedAt: new Date() })
      .where(eq(faxes.telnyxFaxId, faxId))
  }

  if (event_type === "fax.received") {
    const fromNumber = (payload.from as string) ?? "Unknown"

    // Spam check — silently drop if sender is blocked
    const blocked = await db.query.blockedNumbers.findFirst({
      where: eq(blockedNumbers.number, fromNumber),
    })
    if (blocked) return NextResponse.json({ ok: true })

    const toNumber = (payload.to as string) ?? process.env.TELNYX_FROM_NUMBER!
    const pageCount = (payload.page_count as number) ?? null

    // Per-line config for this receiving number (inbound Drive folder + forwarding)
    const numberRecord = await db.query.phoneNumbers.findFirst({
      where: eq(phoneNumbers.number, toNumber),
      columns: { inboundDriveFolder: true, forwardToNumber: true, notifyEmail: true },
    })

    let fileUrl = payload.media_url as string | undefined

    // Re-host fax media on R2 for permanent storage; also mirror to all connected
    // Google Drives, into this line's inbound folder.
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
          uploadToDriveForAll(buffer, driveFileName, contentType, numberRecord?.inboundDriveFolder).catch((e) => console.error("Drive upload (inbound) failed:", e))
        }
      } catch {
        // Keep Telnyx URL as fallback
      }
    }

    await db.insert(faxes).values({
      direction: "inbound",
      status: "received",
      fromNumber,
      toNumber,
      telnyxFaxId: faxId,
      fileUrl,
      pages: pageCount,
    }).onConflictDoNothing({ target: faxes.telnyxFaxId })

    // Email notification — per-number address takes priority, falls back to global NOTIFY_EMAIL
    const notifyTarget = numberRecord?.notifyEmail?.trim() || undefined
    notifyFaxReceived({ fromNumber, toNumber, pages: pageCount, fileUrl: fileUrl ?? null, overrideTo: notifyTarget }).catch(() => {})

    // Auto-forward to an outside number if this receiving number is configured for it
    if (fileUrl) {
      try {
        const forwardTo = numberRecord?.forwardToNumber?.trim()
        if (forwardTo) {
          const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/telnyx`
          const [fwd] = await db.insert(faxes).values({
            direction: "outbound",
            status: "queued",
            fromNumber: toNumber,
            toNumber: forwardTo,
            subject: `Forwarded fax from ${fromNumber}`,
            notes: `Auto-forwarded inbound fax originally from ${fromNumber}`,
            fileUrl,
            pages: pageCount,
          }).returning()
          try {
            const telnyxFax = await sendFax({ from: toNumber, to: forwardTo, mediaUrl: fileUrl, webhookUrl })
            await db.update(faxes).set({ telnyxFaxId: telnyxFax.id, status: "sending" }).where(eq(faxes.id, fwd.id))
          } catch (err) {
            await db.update(faxes).set({ status: "failed", errorMessage: String(err) }).where(eq(faxes.id, fwd.id))
            console.error("Inbound fax forward failed:", err)
          }
        }
      } catch (e) {
        console.error("Inbound fax forward lookup failed:", e)
      }
    }
  }

  return NextResponse.json({ ok: true })
}
