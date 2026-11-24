import { db } from "@/lib/db"
import { faxes, blockedNumbers, phoneNumbers } from "@/lib/db/schema"
import { uploadToR2 } from "@/lib/storage"
import { notifyFaxReceived } from "@/lib/email"
import { verifyTelnyxWebhook } from "@/lib/telnyx-verify"
import { uploadToDriveForAll } from "@/lib/google-drive"
import { uploadToPortalDrive, portalFaxFileName } from "@/lib/portal-drive"
import { sendFax } from "@/lib/telnyx"
import { toE164 } from "@/lib/phone"
import { notifyIntake, notifyIntakeStatus, shouldNotifyIntake, intakeConfigured } from "@/lib/intake"
import { eq } from "drizzle-orm"
import { NextResponse, after } from "next/server"
import { randomUUID } from "crypto"

// Fax-backs sent for intake carry a reference_id; report their outcome to intake
// after the response.
function reportIntakeStatus(
  rows: { id: string; referenceId: string | null }[],
  status: "delivered" | "failed",
  error: string | null,
) {
  if (!intakeConfigured()) return
  for (const row of rows) {
    const referenceId = row.referenceId
    if (!referenceId) continue
    after(() => notifyIntakeStatus({ faxId: row.id, referenceId, status, error }).then(() => {}))
  }
}

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
    const rows = await db
      .update(faxes)
      .set({ status: "delivered", pages: (payload.page_count as number) ?? null, updatedAt: new Date() })
      .where(eq(faxes.telnyxFaxId, faxId))
      .returning({ id: faxes.id, referenceId: faxes.referenceId })
    reportIntakeStatus(rows, "delivered", null)
  }

  if ((event_type === "fax.send.failed" || event_type === "fax.failed") && faxId) {
    const errorMessage = (payload.failure_reason as string) ?? "Unknown error"
    const rows = await db
      .update(faxes)
      .set({ status: "failed", errorMessage, updatedAt: new Date() })
      .where(eq(faxes.telnyxFaxId, faxId))
      .returning({ id: faxes.id, referenceId: faxes.referenceId })
    reportIntakeStatus(rows, "failed", errorMessage)
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
      columns: { label: true, inboundDriveFolder: true, portalDriveFolderId: true, forwardToNumber: true, notifyEmail: true, intakeEnabled: true },
    })

    let fileUrl = payload.media_url as string | undefined
    let inboundFile: { buffer: Buffer; contentType: string } | null = null

    // Re-host fax media on R2 for permanent storage; also mirror to all connected
    // Google Drives, into this line's inbound folder.
    //
    // IMPORTANT: Telnyx's media_url is a pre-signed AWS S3 link (auth is carried
    // in the query string). Do NOT add an Authorization header — S3 rejects any
    // request that presents two auth mechanisms with HTTP 400, which previously
    // caused this fetch to fail, the re-host to be skipped, and the temporary
    // (soon-to-expire) Telnyx URL to be stored instead. Only api.telnyx.com URLs
    // would need the Bearer token.
    if (fileUrl) {
      try {
        const needsBearer = /(^|\.)telnyx\.com/i.test(new URL(fileUrl).hostname)
        const res = await fetch(fileUrl, {
          headers: needsBearer ? { Authorization: `Bearer ${process.env.TELNYX_API_KEY}` } : {},
        })
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer())
          const contentType = res.headers.get("content-type") ?? "application/pdf"
          fileUrl = await uploadToR2(buffer, `inbound/${randomUUID()}.pdf`, contentType)
          inboundFile = { buffer, contentType }
          const driveFileName = `Inbound-${fromNumber}-${new Date().toISOString().slice(0, 10)}.pdf`
          uploadToDriveForAll(buffer, driveFileName, contentType, numberRecord?.inboundDriveFolder).catch((e) => console.error("Drive upload (inbound) failed:", e))
        } else {
          console.error(`Inbound media re-host skipped: fetch ${res.status} for ${new URL(fileUrl).host}`)
        }
      } catch (e) {
        // Keep Telnyx URL as fallback, but log so this isn't silently missed.
        console.error("Inbound media re-host failed:", e instanceof Error ? e.message : e)
      }
    }

    const [inserted] = await db.insert(faxes).values({
      direction: "inbound",
      status: "received",
      fromNumber,
      toNumber,
      telnyxFaxId: faxId,
      fileUrl,
      pages: pageCount,
    }).onConflictDoNothing({ target: faxes.telnyxFaxId })
      .returning({ id: faxes.id, createdAt: faxes.createdAt })

    // Copy into the shared portal Drive folder configured for this line. Skipped on a
    // duplicate webhook (no row inserted) so retries don't create duplicate files.
    const portalFolderId = numberRecord?.portalDriveFolderId?.trim()
    if (inserted && inboundFile && portalFolderId) {
      try {
        await uploadToPortalDrive(inboundFile.buffer, portalFaxFileName(toNumber, inserted.createdAt, inserted.id), portalFolderId, inboundFile.contentType)
      } catch (e) {
        console.error(`Portal Drive upload failed for fax ${inserted.id}:`, e instanceof Error ? e.message : e)
      }
    }

    // Announce to referral intake after the response, so Telnyx is never kept waiting
    // on intake. Skipped on a duplicate webhook (no row inserted). A missed or failed
    // announcement leaves intake_notified_at null for scripts/intake-replay.ts.
    if (shouldNotifyIntake({ inserted: !!inserted, hasFile: !!fileUrl, line: numberRecord })) {
      const event = {
        faxId: inserted.id,
        from: fromNumber,
        to: toNumber,
        lineLabel: numberRecord?.label ?? null,
        pages: pageCount,
        receivedAt: inserted.createdAt.toISOString(),
      }
      after(async () => {
        if (await notifyIntake(event)) {
          await db.update(faxes).set({ intakeNotifiedAt: new Date() }).where(eq(faxes.id, event.faxId))
        }
      })
    }

    // Email notification — per-number address takes priority, falls back to global NOTIFY_EMAIL
    const notifyTarget = numberRecord?.notifyEmail?.trim() || undefined
    notifyFaxReceived({ fromNumber, toNumber, pages: pageCount, fileUrl: fileUrl ?? null, overrideTo: notifyTarget }).catch(() => {})

    // Auto-forward to an outside number if this receiving number is configured for it
    if (fileUrl) {
      try {
        const forwardTo = toE164(numberRecord?.forwardToNumber)
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
