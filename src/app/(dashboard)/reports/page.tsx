import { db } from "@/lib/db"
import { faxes, users, phoneNumbers } from "@/lib/db/schema"
import { and, count, eq, gte, isNull, sql, desc } from "drizzle-orm"

export const dynamic = "force-dynamic"

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{typeof value === "number" ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default async function ReportsPage() {
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7)
  const monthStart = new Date(now); monthStart.setDate(now.getDate() - 30)

  const [
    sentToday, receivedToday,
    sentWeek, receivedWeek,
    sentMonth, receivedMonth,
    failedMonth,
    pagesMonth,
    totalSent, totalReceived,
    topNumbers,
    topSenders,
  ] = await Promise.all([
    db.select({ v: count() }).from(faxes).where(and(eq(faxes.direction, "outbound"), gte(faxes.createdAt, todayStart), isNull(faxes.trashedAt))),
    db.select({ v: count() }).from(faxes).where(and(eq(faxes.direction, "inbound"), gte(faxes.createdAt, todayStart), isNull(faxes.trashedAt))),
    db.select({ v: count() }).from(faxes).where(and(eq(faxes.direction, "outbound"), gte(faxes.createdAt, weekStart), isNull(faxes.trashedAt))),
    db.select({ v: count() }).from(faxes).where(and(eq(faxes.direction, "inbound"), gte(faxes.createdAt, weekStart), isNull(faxes.trashedAt))),
    db.select({ v: count() }).from(faxes).where(and(eq(faxes.direction, "outbound"), gte(faxes.createdAt, monthStart), isNull(faxes.trashedAt))),
    db.select({ v: count() }).from(faxes).where(and(eq(faxes.direction, "inbound"), gte(faxes.createdAt, monthStart), isNull(faxes.trashedAt))),
    db.select({ v: count() }).from(faxes).where(and(eq(faxes.status, "failed"), gte(faxes.createdAt, monthStart))),
    db.select({ v: sql<number>`COALESCE(SUM(${faxes.pages}), 0)::int` }).from(faxes).where(and(gte(faxes.createdAt, monthStart), isNull(faxes.trashedAt))),
    db.select({ v: count() }).from(faxes).where(and(eq(faxes.direction, "outbound"), isNull(faxes.trashedAt))),
    db.select({ v: count() }).from(faxes).where(and(eq(faxes.direction, "inbound"), isNull(faxes.trashedAt))),
    db.select({
      number: faxes.fromNumber,
      label: phoneNumbers.label,
      sent: count(),
    })
      .from(faxes)
      .leftJoin(phoneNumbers, eq(faxes.fromNumber, phoneNumbers.number))
      .where(and(eq(faxes.direction, "outbound"), gte(faxes.createdAt, monthStart), isNull(faxes.trashedAt)))
      .groupBy(faxes.fromNumber, phoneNumbers.label)
      .orderBy(desc(count()))
      .limit(5),
    db.select({
      userId: faxes.userId,
      name: users.name,
      email: users.email,
      sent: count(),
    })
      .from(faxes)
      .leftJoin(users, eq(faxes.userId, users.id))
      .where(and(eq(faxes.direction, "outbound"), gte(faxes.createdAt, monthStart), isNull(faxes.trashedAt)))
      .groupBy(faxes.userId, users.name, users.email)
      .orderBy(desc(count()))
      .limit(5),
  ])

  const periods = [
    { label: "Today", sent: sentToday[0]?.v ?? 0, received: receivedToday[0]?.v ?? 0 },
    { label: "Last 7 Days", sent: sentWeek[0]?.v ?? 0, received: receivedWeek[0]?.v ?? 0 },
    { label: "Last 30 Days", sent: sentMonth[0]?.v ?? 0, received: receivedMonth[0]?.v ?? 0 },
  ]

  return (
    <div className="max-w-5xl">
      <div className="flex items-baseline gap-3 mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Reports</h1>
        <span className="text-sm text-gray-400 border-l border-gray-200 pl-3">Usage Overview</span>
      </div>

      {/* Period summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {periods.map((p) => (
          <div key={p.label} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{p.label}</p>
            <div className="flex gap-6">
              <div>
                <p className="text-2xl font-bold text-blue-600">{p.sent.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-0.5">Sent</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{p.received.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-0.5">Received</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Totals row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Sent (All Time)" value={totalSent[0]?.v ?? 0} />
        <StatCard label="Total Received (All Time)" value={totalReceived[0]?.v ?? 0} />
        <StatCard label="Pages Transmitted (30d)" value={pagesMonth[0]?.v ?? 0} sub="sent + received" />
        <StatCard label="Failed (30d)" value={failedMonth[0]?.v ?? 0} sub="delivery failures" />
      </div>

      {/* Top numbers + top senders */}
      <div className="grid grid-cols-2 gap-6">
        {/* Top sending numbers */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Top Sending Numbers</h2>
            <p className="text-xs text-gray-400 mt-0.5">Last 30 days</p>
          </div>
          {topNumbers.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400">No data yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-50">
                {topNumbers.map((n, i) => (
                  <tr key={n.number} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-400 text-xs w-6">{i + 1}</td>
                    <td className="px-2 py-3">
                      <p className="font-mono text-gray-900 text-xs">{n.number}</p>
                      {n.label && <p className="text-gray-400 text-xs">{n.label}</p>}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-blue-600">{n.sent.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Top senders */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Top Senders</h2>
            <p className="text-xs text-gray-400 mt-0.5">Last 30 days</p>
          </div>
          {topSenders.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400">No data yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-50">
                {topSenders.map((s, i) => (
                  <tr key={s.userId ?? i} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-400 text-xs w-6">{i + 1}</td>
                    <td className="px-2 py-3">
                      <p className="font-medium text-gray-900 text-xs">{s.name ?? "Unknown"}</p>
                      {s.email && <p className="text-gray-400 text-xs">{s.email}</p>}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-blue-600">{s.sent.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
