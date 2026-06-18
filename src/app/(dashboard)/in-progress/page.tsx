import { db } from "@/lib/db"
import { faxes, phoneNumbers } from "@/lib/db/schema"
import { and, count, eq, gte, inArray, isNull, desc } from "drizzle-orm"
import FaxTable from "@/components/fax-table"
import AutoRefresh from "@/components/auto-refresh"

export const dynamic = "force-dynamic"

export default async function InProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; number?: string }>
}) {
  const { tab, number } = await searchParams
  const activeTab = tab === "sending" ? "sending" : "inbound"

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

  const inboundConditions = [
    eq(faxes.direction, "inbound"),
    isNull(faxes.trashedAt),
    gte(faxes.createdAt, oneHourAgo),
  ]
  const sendingConditions = [
    eq(faxes.direction, "outbound"),
    isNull(faxes.trashedAt),
    inArray(faxes.status, ["queued", "sending"]),
  ]
  if (number) {
    inboundConditions.push(eq(faxes.toNumber, number))
    sendingConditions.push(eq(faxes.fromNumber, number))
  }

  const [inboundRows, sendingRows, inboundCount, sendingCount, numbers] = await Promise.all([
    activeTab === "inbound"
      ? db.query.faxes.findMany({ where: and(...inboundConditions), orderBy: [desc(faxes.createdAt)], limit: 100 })
      : Promise.resolve([]),
    activeTab === "sending"
      ? db.query.faxes.findMany({ where: and(...sendingConditions), orderBy: [desc(faxes.createdAt)], limit: 100 })
      : Promise.resolve([]),
    db.select({ value: count() }).from(faxes).where(and(...inboundConditions)),
    db.select({ value: count() }).from(faxes).where(and(...sendingConditions)),
    db.query.phoneNumbers.findMany({ where: eq(phoneNumbers.active, true) }),
  ])

  const ic = inboundCount[0]?.value ?? 0
  const sc = sendingCount[0]?.value ?? 0
  const rows = activeTab === "inbound" ? inboundRows : sendingRows

  const phoneLabels = Object.fromEntries(numbers.map((n) => [n.number, n.label ?? ""]))

  return (
    <div>
      <AutoRefresh intervalMs={15000} />
      <div className="flex items-baseline gap-3 mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Faxes In Progress</h1>
        <span className="text-sm text-gray-400 border-l border-gray-200 pl-3">
          {activeTab === "inbound" ? "Inbound" : "Sending"}
        </span>
      </div>

      {/* Inbound / Sending tabs */}
      <div className="flex mb-4 rounded-lg overflow-hidden border border-gray-200 w-fit">
        <a
          href="/in-progress"
          className={`px-6 py-2 text-sm font-medium flex items-center gap-2 transition-colors ${activeTab === "inbound" ? "bg-blue-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
        >
          Inbound
          <span className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ${activeTab === "inbound" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"}`}>
            {ic}
          </span>
        </a>
        <a
          href="/in-progress?tab=sending"
          className={`px-6 py-2 text-sm font-medium flex items-center gap-2 border-l border-gray-200 transition-colors ${activeTab === "sending" ? "bg-blue-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
        >
          Sending
          <span className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ${activeTab === "sending" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"}`}>
            {sc}
          </span>
        </a>
      </div>

      {/* Number filter */}
      {numbers.length > 1 && (
        <div className="mb-4 flex items-center gap-2">
          <a href={`/in-progress${tab ? `?tab=${tab}` : ""}`} className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${!number ? "bg-blue-50 border-blue-200 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
            All Numbers
          </a>
          {numbers.map((n) => (
            <a key={n.number} href={`/in-progress?${tab ? `tab=${tab}&` : ""}number=${encodeURIComponent(n.number)}`}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${number === n.number ? "bg-blue-50 border-blue-200 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {n.label ?? n.number}
            </a>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mb-4">Refreshes every 15 seconds.</p>

      <div className="bg-white rounded-xl border border-gray-200 px-4">
        <FaxTable
          faxes={rows}
          direction={activeTab === "inbound" ? "inbound" : "outbound"}
          phoneLabels={phoneLabels}
          emptyMessage={activeTab === "inbound" ? "No inbound faxes in the last hour." : "No faxes currently sending."}
        />
      </div>
    </div>
  )
}
