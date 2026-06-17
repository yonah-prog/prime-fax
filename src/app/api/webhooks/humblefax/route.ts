import { db } from "@/lib/db"
import { faxes } from "@/lib/db/schema"
import { e164, mapInboundStatus, mapOutboundStatus, type HFInboundFax, type HFSentFax } from "@/lib/humblefax"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { randomUUID } from "crypto"

export async function POST(req: Request) {
  let body: { type?: string; data?: Record<string, unknown> }
  try { body = await req.json() } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }) }

  const { type, data } = body
  if (!type || !data) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })

  // ── Inbound fax received ──────────────────────────────────────────────────
  if (type === "IncomingFax.SendComplete") {
    const f = data as unknown as HFInboundFax
    await db
      .insert(faxes)
      .values({
        direction: "inbound",
        status: mapInboundStatus(f.status),
        fromNumber: e164(f.fromNumber),
        fromName: f.fromNameIdentity || f.fromNameAddressBook || null,
        toNumber: e164(f.toNumber),
        pages: f.numPages ? parseInt(f.numPages) : null,
        humblefaxId: f.id,
        createdAt: new Date(parseInt(f.time) * 1000),
        updatedAt: new Date(),
      })
      .onConflictDoNothing({ target: faxes.humblefaxId })
  }

  // ── Sent fax status update ─────────────────────────────────────────────────
  if (type === "SentFax.SendComplete") {
    const f = data as unknown as HFSentFax
    for (const r of f.recipients ?? []) {
      const hid = `${f.id}-${String(r.toNumber)}`
      const status = mapOutboundStatus(r.status)
      const failureReason = (r.attempts ?? [])
        .flatMap((a) => a.calls ?? [])
        .find((c) => c.failureReason)?.failureReason ?? null

      const existing = await db.query.faxes.findFirst({ where: eq(faxes.humblefaxId, hid) })
      if (existing) {
        await db.update(faxes).set({ status, errorMessage: failureReason, updatedAt: new Date() })
          .where(eq(faxes.humblefaxId, hid))
      } else {
        const broadcastId = f.recipients.length > 1 ? randomUUID() : null
        const sentAt = new Date(parseInt(f.timestamp) * 1000)
        await db.insert(faxes).values({
          direction: "outbound",
          status,
          fromNumber: e164(f.fromNumber),
          fromName: f.fromName || null,
          toNumber: e164(r.toNumber),
          subject: f.subject || null,
          coverSheetMessage: f.message || null,
          hasCoverSheet: f.hasCoversheet,
          pages: f.numPages ? parseInt(f.numPages) : null,
          pageSize: (f.pageSize?.toLowerCase() as "letter" | "legal" | "a4") ?? "letter",
          resolution: (f.resolution?.toLowerCase() as "fine" | "standard") ?? "fine",
          errorMessage: failureReason,
          humblefaxId: hid,
          broadcastId,
          createdAt: sentAt,
          updatedAt: new Date(),
        })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
