/**
 * Re-announce inbound faxes that referral intake never acknowledged.
 * Run: npm run intake:replay -- --since 2026-11-01 [--dry-run]
 *
 * Picks inbound faxes received on or after --since, on intake-enabled lines,
 * with a stored file and intake_notified_at still null (intake was down, the
 * hook was not configured yet, or every retry failed). Safe to re-run: intake
 * is idempotent on faxId, and acknowledged faxes are stamped and skipped.
 */
import { db } from "../lib/db"
import { faxes, phoneNumbers } from "../lib/db/schema"
import { notifyIntake, intakeConfigured } from "../lib/intake"
import { and, asc, eq, gte, isNotNull, isNull } from "drizzle-orm"

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const sinceRaw = arg("--since")
  const dryRun = process.argv.includes("--dry-run")
  const since = sinceRaw ? new Date(`${sinceRaw}T00:00:00Z`) : null
  if (!since || Number.isNaN(since.getTime())) {
    console.error("Usage: npm run intake:replay -- --since YYYY-MM-DD [--dry-run]")
    process.exit(1)
  }
  if (!dryRun && !intakeConfigured()) {
    console.error("INTAKE_HOOK_URL and INTAKE_HOOK_SECRET must be set (or pass --dry-run).")
    process.exit(1)
  }

  const rows = await db
    .select({
      id: faxes.id,
      fromNumber: faxes.fromNumber,
      toNumber: faxes.toNumber,
      pages: faxes.pages,
      createdAt: faxes.createdAt,
      lineLabel: phoneNumbers.label,
    })
    .from(faxes)
    .innerJoin(phoneNumbers, eq(phoneNumbers.number, faxes.toNumber))
    .where(and(
      eq(faxes.direction, "inbound"),
      gte(faxes.createdAt, since),
      isNull(faxes.intakeNotifiedAt),
      isNull(faxes.trashedAt),
      isNotNull(faxes.fileUrl),
      eq(phoneNumbers.intakeEnabled, true),
    ))
    .orderBy(asc(faxes.createdAt))

  console.log(`${rows.length} unacknowledged fax(es) since ${sinceRaw}${dryRun ? " (dry run)" : ""}`)
  let ok = 0
  for (const r of rows) {
    if (dryRun) {
      console.log(`  would send ${r.id}  ${r.createdAt.toISOString()}  line ${r.toNumber}`)
      continue
    }
    const acked = await notifyIntake({
      faxId: r.id,
      from: r.fromNumber,
      to: r.toNumber,
      lineLabel: r.lineLabel,
      pages: r.pages,
      receivedAt: r.createdAt.toISOString(),
    })
    if (acked) {
      await db.update(faxes).set({ intakeNotifiedAt: new Date() }).where(eq(faxes.id, r.id))
      ok++
    }
    console.log(`  ${acked ? "sent  " : "FAILED"} ${r.id}`)
  }
  if (!dryRun) console.log(`${ok}/${rows.length} acknowledged`)
  process.exit(!dryRun && ok < rows.length ? 2 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
