import { db } from "@/lib/db"
import { faxes } from "@/lib/db/schema"
import { and, count, eq, isNotNull, inArray, desc, sql, type SQL } from "drizzle-orm"
import FaxTable from "@/components/fax-table"
import FaxToolbar from "@/components/fax-toolbar"
import { getFaxAccess } from "@/lib/fax-access"
import { Suspense } from "react"

export const dynamic = "force-dynamic"

export default async function TrashPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const activeTab = tab === "sent" ? "sent" : "received"

  // Per-user access scoping (same rules as the inbox/sent pages).
  const access = await getFaxAccess()
  const inboundCond: SQL[] = access.isAdmin
    ? []
    : (!access.canViewInbound || access.numbers.length === 0)
      ? [sql`false`]
      : [inArray(faxes.toNumber, access.numbers)]
  const outboundCond: SQL[] = access.isAdmin || access.canViewAllSent
    ? []
    : [eq(faxes.userId, access.userId ?? "")]

  const activeCond = activeTab === "sent" ? outboundCond : inboundCond
  const dirFilter = activeTab === "sent"
    ? eq(faxes.direction, "outbound")
    : eq(faxes.direction, "inbound")

  const [rows, receivedCount, sentCount] = await Promise.all([
    db.query.faxes.findMany({
      where: and(isNotNull(faxes.trashedAt), dirFilter, ...activeCond),
      orderBy: [desc(faxes.trashedAt)],
      limit: 100,
    }),
    db.select({ value: count() }).from(faxes).where(
      and(isNotNull(faxes.trashedAt), eq(faxes.direction, "inbound"), ...inboundCond)
    ),
    db.select({ value: count() }).from(faxes).where(
      and(isNotNull(faxes.trashedAt), eq(faxes.direction, "outbound"), ...outboundCond)
    ),
  ])

  const rc = receivedCount[0]?.value ?? 0
  const sc = sentCount[0]?.value ?? 0

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Trash Bin</h1>
        <span className="text-sm text-gray-400 border-l border-gray-200 pl-3">All Time</span>
      </div>

      <Suspense>
        <FaxToolbar total={rc + sc} isTrash />
      </Suspense>

      <p className="text-sm text-gray-500 mb-4">
        Faxes in trash are automatically deleted after 30 days.
      </p>

      {/* Received / Sent tabs */}
      <div className="flex mb-4 rounded-lg overflow-hidden border border-gray-200 w-fit">
        <a
          href="/trash"
          className={`px-6 py-2 text-sm font-medium transition-colors ${activeTab === "received" ? "bg-blue-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
        >
          Received {rc > 0 && <span className="ml-1">{rc}</span>}
        </a>
        <a
          href="/trash?tab=sent"
          className={`px-6 py-2 text-sm font-medium transition-colors border-l border-gray-200 ${activeTab === "sent" ? "bg-blue-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
        >
          Sent {sc > 0 && <span className="ml-1">{sc}</span>}
        </a>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 px-4">
        <FaxTable
          faxes={rows}
          direction="trash"
          emptyMessage={`No ${activeTab} faxes in trash.`}
        />
      </div>
    </div>
  )
}
