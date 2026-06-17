/**
 * One-time (and re-runnable) bulk sync from HumbleFax → CareTend DB.
 * Run: npx tsx --env-file=.env.local src/scripts/humblefax-sync.ts
 *
 * Safe to re-run: existing records are skipped via ON CONFLICT DO NOTHING.
 */
import {
  hfGetIncomingFaxes,
  hfGetSentFaxIds,
  hfGetSentFax,
  hfGetNumbers,
  hfRegisterWebhook,
  e164,
  mapInboundStatus,
  mapOutboundStatus,
  type HFSentFax,
} from "../lib/humblefax"
import { db } from "../lib/db"
import { faxes, phoneNumbers } from "../lib/db/schema"
import { eq } from "drizzle-orm"
import { randomUUID } from "crypto"

const CONCURRENCY = 5
const BATCH_DELAY_MS = 1500

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchWithRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn()
    } catch (e) {
      const msg = String(e)
      if (msg.includes("Too Many Requests") && attempt < retries - 1) {
        const wait = 3000 * (attempt + 1)
        process.stdout.write(` [rate-limited, waiting ${wait / 1000}s]`)
        await sleep(wait)
      } else {
        throw e
      }
    }
  }
  throw new Error("Max retries exceeded")
}

async function batchedFetch<T>(ids: string[], fn: (id: string) => Promise<T>): Promise<T[]> {
  const results: T[] = []
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const slice = ids.slice(i, i + CONCURRENCY)
    const batch = await Promise.all(slice.map((id) => fetchWithRetry(() => fn(id))))
    results.push(...batch)
    process.stdout.write(`\r  fetched ${Math.min(i + CONCURRENCY, ids.length)}/${ids.length}`)
    if (i + CONCURRENCY < ids.length) await sleep(BATCH_DELAY_MS)
  }
  process.stdout.write("\n")
  return results
}

// ── NUMBERS ──────────────────────────────────────────────────────────────────

async function syncNumbers() {
  console.log("\n── Phone Numbers ──")
  const numbers = await hfGetNumbers()
  console.log(`  Found ${numbers.length} numbers`)

  for (const n of numbers) {
    const num = e164(n.number)
    const existing = await db.query.phoneNumbers.findFirst({ where: eq(phoneNumbers.number, num) })
    if (existing) {
      console.log(`  SKIP  ${num} (${n.departmentName ?? "unlabeled"}) — already exists`)
      continue
    }
    await db.insert(phoneNumbers).values({
      number: num,
      label: n.departmentName ?? null,
      active: true,
      isDefault: false,
    })
    console.log(`  ADD   ${num} (${n.departmentName ?? "unlabeled"})`)
  }
}

// ── INBOUND FAXES ─────────────────────────────────────────────────────────────

async function syncInbound() {
  console.log("\n── Inbound Faxes ──")
  const all = await hfGetIncomingFaxes()
  console.log(`  Found ${all.length} inbound faxes`)

  let added = 0
  let skipped = 0

  for (const f of all) {
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
        updatedAt: new Date(parseInt(f.time) * 1000),
      })
      .onConflictDoNothing({ target: faxes.humblefaxId })

    added++
    if (added % 100 === 0) process.stdout.write(`\r  inserted ${added}/${all.length}`)
  }
  process.stdout.write("\n")
  console.log(`  Done: ${added} processed, ${skipped} skipped`)
}

// ── SENT FAXES ────────────────────────────────────────────────────────────────

function sentFaxToRows(f: HFSentFax): Parameters<typeof db.insert>[0] extends infer T ? T[] : never[] {
  const broadcastId = f.recipients.length > 1 ? randomUUID() : null
  const sentAt = new Date(parseInt(f.timestamp) * 1000)

  return f.recipients.map((r) => {
    const recipStatus = mapOutboundStatus(r.status)
    const failureReason = r.attempts
      .flatMap((a) => a.calls ?? [])
      .find((c) => c.failureReason)?.failureReason ?? null

    return {
      direction: "outbound" as const,
      status: recipStatus,
      fromNumber: e164(f.fromNumber),
      fromName: f.fromName || null,
      toNumber: e164(r.toNumber),
      subject: f.subject || null,
      coverSheetMessage: f.message || null,
      hasCoverSheet: f.hasCoversheet,
      pages: f.numPages ? parseInt(f.numPages) : null,
      pageSize: (f.pageSize?.toLowerCase() as "letter" | "legal" | "a4" | null) ?? "letter",
      resolution: (f.resolution?.toLowerCase() as "fine" | "standard" | null) ?? "fine",
      errorMessage: failureReason,
      humblefaxId: `${f.id}-${String(r.toNumber)}`,
      broadcastId,
      createdAt: sentAt,
      updatedAt: sentAt,
    }
  })
}

async function syncSent() {
  console.log("\n── Sent Faxes ──")
  const ids = await hfGetSentFaxIds()
  console.log(`  Found ${ids.length} sent faxes — fetching details...`)

  const records = await batchedFetch(ids, hfGetSentFax)

  let added = 0
  for (const f of records) {
    const rows = sentFaxToRows(f)
    for (const row of rows) {
      await db.insert(faxes).values(row).onConflictDoNothing({ target: faxes.humblefaxId })
      added++
    }
  }
  console.log(`  Done: ${added} rows inserted`)
}

// ── WEBHOOK ───────────────────────────────────────────────────────────────────

async function registerWebhook() {
  console.log("\n── Webhook Registration ──")
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl || appUrl.includes("localhost")) {
    console.log("  SKIP — NEXT_PUBLIC_APP_URL is localhost; deploy first, then re-run to register webhook")
    return
  }
  const url = `${appUrl}/api/webhooks/humblefax`
  const result = await hfRegisterWebhook(url)
  console.log("  Result:", JSON.stringify(result))
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== HumbleFax → CareTend Sync ===")
  await syncNumbers()
  await syncInbound()
  await syncSent()
  await registerWebhook()
  console.log("\n✓ Sync complete")
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
