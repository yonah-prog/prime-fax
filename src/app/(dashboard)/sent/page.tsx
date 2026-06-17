import { db } from "@/lib/db"
import { faxes, phoneNumbers } from "@/lib/db/schema"
import { and, count, eq, gte, ilike, isNull, lte, ne, or, desc } from "drizzle-orm"
import FaxTable from "@/components/fax-table"
import AutoRefresh from "@/components/auto-refresh"
import FaxToolbar from "@/components/fax-toolbar"
import Pagination from "@/components/pagination"
import { Suspense } from "react"

export const dynamic = "force-dynamic"

const PER_PAGE = 50

export default async function SentPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string; from?: string; to?: string; page?: string
    hideFailed?: string; number?: string
  }>
}) {
  const p = await searchParams
  const page = Math.max(1, parseInt(p.page ?? "1"))

  const base = [eq(faxes.direction, "outbound"), isNull(faxes.trashedAt)]
  if (p.q) base.push(or(ilike(faxes.toNumber, `%${p.q}%`), ilike(faxes.recipientName, `%${p.q}%`), ilike(faxes.subject, `%${p.q}%`))!)
  if (p.from) base.push(gte(faxes.createdAt, new Date(p.from)))
  if (p.to) { const d = new Date(p.to); d.setDate(d.getDate() + 1); base.push(lte(faxes.createdAt, d)) }
  if (p.hideFailed === "1") base.push(ne(faxes.status, "failed"))
  if (p.number) base.push(eq(faxes.fromNumber, p.number))

  const where = and(...base)

  const [totalRes, failedRes, rows, numbers] = await Promise.all([
    db.select({ value: count() }).from(faxes).where(where),
    db.select({ value: count() }).from(faxes).where(
      and(eq(faxes.direction, "outbound"), isNull(faxes.trashedAt), eq(faxes.status, "failed"))
    ),
    db.query.faxes.findMany({ where, orderBy: [desc(faxes.createdAt)], limit: PER_PAGE, offset: (page - 1) * PER_PAGE }),
    db.query.phoneNumbers.findMany({ where: eq(phoneNumbers.active, true) }),
  ])

  const total = totalRes[0]?.value ?? 0
  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div>
      <AutoRefresh intervalMs={30000} />
      <div className="flex items-baseline gap-3 mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Sent Faxes</h1>
        <span className="text-sm text-gray-400 border-l border-gray-200 pl-3">Last 30 Days</span>
      </div>
      <Suspense>
        <FaxToolbar
          failedCount={failedRes[0]?.value ?? 0}
          total={total}
          phoneNumbers={numbers.map((n) => ({ number: n.number, label: n.label }))}
        />
      </Suspense>
      <div className="bg-white rounded-xl border border-gray-200 px-4">
        <FaxTable faxes={rows} direction="outbound" emptyMessage="No sent faxes matching your filters." />
      </div>
      <Suspense><Pagination page={page} totalPages={totalPages} /></Suspense>
    </div>
  )
}
