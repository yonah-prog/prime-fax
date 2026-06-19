import { db } from "@/lib/db"
import { faxes } from "@/lib/db/schema"
import { sendFax } from "@/lib/telnyx"
import { and, eq, isNull, lte } from "drizzle-orm"
import { NextResponse } from "next/server"

// Called by Railway cron (or any scheduler) — protected by a simple shared secret
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization")
  const expectedToken = process.env.CRON_SECRET
  // Fail closed: if no secret is configured, refuse rather than expose the
  // endpoint publicly (it triggers real fax sends).
  if (!expectedToken) {
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 })
  }
  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const due = await db.query.faxes.findMany({
    where: and(
      eq(faxes.status, "scheduled"),
      lte(faxes.scheduledAt, now),
      isNull(faxes.trashedAt)
    ),
  })

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/telnyx`
  let sent = 0
  let failed = 0

  for (const fax of due) {
    if (!fax.fileUrl) continue
    try {
      const telnyxFax = await sendFax({ from: fax.fromNumber, to: fax.toNumber, mediaUrl: fax.fileUrl, webhookUrl })
      await db.update(faxes)
        .set({ telnyxFaxId: telnyxFax.id, status: "sending", scheduledAt: null, updatedAt: new Date() })
        .where(eq(faxes.id, fax.id))
      sent++
    } catch {
      await db.update(faxes)
        .set({ status: "failed", errorMessage: "Scheduled send failed", updatedAt: new Date() })
        .where(eq(faxes.id, fax.id))
      failed++
    }
  }

  return NextResponse.json({ processed: due.length, sent, failed })
}
