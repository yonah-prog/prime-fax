import { db } from "@/lib/db"
import { faxes, phoneNumbers, users } from "@/lib/db/schema"
import { and, asc, count, eq, gte, ilike, isNull, lte, ne, or, desc, sql } from "drizzle-orm"
import { getFaxAccess } from "@/lib/fax-access"
import FaxTable from "@/components/fax-table"
import AutoRefresh from "@/components/auto-refresh"
import FaxToolbar from "@/components/fax-toolbar"
import Pagination from "@/components/pagination"
import { Suspense } from "react"

export const dynamic = "force-dynamic"

const PER_PAGE = 50

function buildOrder(sortBy: string) {
  switch (sortBy) {
    case "date_asc": return [asc(faxes.createdAt)]
    case "status": return [asc(faxes.status), desc(faxes.createdAt)]
    case "pages": return [desc(faxes.pages), desc(faxes.createdAt)]
    case "to_number": return [asc(faxes.toNumber), desc(faxes.createdAt)]
    case "subject": return [asc(faxes.subject), desc(faxes.createdAt)]
    case "from_number": return [asc(faxes.fromNumber), desc(faxes.createdAt)]
    default: return [desc(faxes.createdAt)]
  }
}

export default async function SentPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string; from?: string; to?: string; page?: string
    hideFailed?: string; number?: string; userId?: string; imageView?: string
    sortBy?: string; showDeleted?: string
  }>
}) {
  const p = await searchParams
  const page = Math.max(1, parseInt(p.page ?? "1"))
  const sortBy = p.sortBy ?? "date_desc"
  const showDeleted = p.showDeleted === "1"

  // Per-user access scoping: staff without "view all sent" only see their own.
  const access = await getFaxAccess()
  const base = [eq(faxes.direction, "outbound")]
  if (!access.isAdmin && !access.canViewAllSent) base.push(eq(faxes.userId, access.userId ?? ""))
  if (!showDeleted) base.push(isNull(faxes.trashedAt))
  if (p.q) base.push(or(
    ilike(faxes.toNumber, `%${p.q}%`),
    ilike(faxes.recipientName, `%${p.q}%`),
    ilike(faxes.subject, `%${p.q}%`),
  )!)
  if (p.from) base.push(gte(faxes.createdAt, new Date(p.from)))
  if (p.to) { const d = new Date(p.to); d.setDate(d.getDate() + 1); base.push(lte(faxes.createdAt, d)) }
  if (p.hideFailed === "1") base.push(ne(faxes.status, "failed"))
  if (p.number) base.push(eq(faxes.fromNumber, p.number))
  if (p.userId) base.push(eq(faxes.userId, p.userId))

  const where = and(...base)
  const orderBy = buildOrder(sortBy)

  const [totalRes, failedRes, pagesRes, rows, numbers, allUsers] = await Promise.all([
    db.select({ value: count() }).from(faxes).where(where),
    db.select({ value: count() }).from(faxes).where(
      and(eq(faxes.direction, "outbound"), isNull(faxes.trashedAt), eq(faxes.status, "failed"))
    ),
    db.select({ value: sql<number>`COALESCE(SUM(${faxes.pages}), 0)::int` }).from(faxes).where(where),
    db.query.faxes.findMany({ where, orderBy, limit: PER_PAGE, offset: (page - 1) * PER_PAGE }),
    db.query.phoneNumbers.findMany({ where: eq(phoneNumbers.active, true) }),
    db.query.users.findMany({ columns: { id: true, name: true, email: true }, orderBy: [asc(users.name)] }),
  ])

  const total = totalRes[0]?.value ?? 0
  const totalFaxPages = pagesRes[0]?.value ?? 0
  const totalPages = Math.ceil(total / PER_PAGE)

  // Build phoneLabels for FROM column (outgoing number → label)
  const phoneLabels = Object.fromEntries(numbers.map((n) => [n.number, n.label ?? ""]))

  // Build senders map keyed by userId
  const senders: Record<string, { name: string; email: string }> = {}
  for (const u of allUsers) {
    senders[u.id] = { name: u.name, email: u.email }
  }

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
          totalFaxPages={totalFaxPages}
          showDeletedToggle
          phoneNumbers={numbers.map((n) => ({ number: n.number, label: n.label }))}
          users={allUsers.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
        />
      </Suspense>
      <div className="bg-white rounded-xl border border-gray-200 px-4">
        <FaxTable
          faxes={rows}
          direction="outbound"
          emptyMessage="No sent faxes matching your filters."
          phoneLabels={phoneLabels}
          senders={senders}
          imageView={p.imageView === "1"}
        />
      </div>
      <Suspense><Pagination page={page} totalPages={totalPages} /></Suspense>
    </div>
  )
}
