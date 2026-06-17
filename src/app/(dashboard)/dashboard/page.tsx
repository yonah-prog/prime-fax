import { db } from "@/lib/db"
import { faxes } from "@/lib/db/schema"
import { and, count, eq, gte, inArray, isNull } from "drizzle-orm"
import StatusBadge from "@/components/status-badge"
import Link from "next/link"
import AutoRefresh from "@/components/auto-refresh"

export const dynamic = "force-dynamic"

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className={`text-3xl font-bold mb-1 ${color}`}>{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  )
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  })
}

export default async function DashboardPage() {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [sentToday, receivedToday, failedToday, inProgress, recentActivity] = await Promise.all([
    db.select({ value: count() }).from(faxes).where(
      and(eq(faxes.direction, "outbound"), gte(faxes.createdAt, todayStart), isNull(faxes.trashedAt))
    ),
    db.select({ value: count() }).from(faxes).where(
      and(eq(faxes.direction, "inbound"), gte(faxes.createdAt, todayStart), isNull(faxes.trashedAt))
    ),
    db.select({ value: count() }).from(faxes).where(
      and(eq(faxes.status, "failed"), gte(faxes.createdAt, todayStart))
    ),
    db.select({ value: count() }).from(faxes).where(
      and(inArray(faxes.status, ["queued", "sending"]), isNull(faxes.trashedAt))
    ),
    db.query.faxes.findMany({
      where: isNull(faxes.trashedAt),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      limit: 10,
      columns: { id: true, direction: true, status: true, fromNumber: true, toNumber: true, pages: true, subject: true, createdAt: true },
    }),
  ])

  return (
    <div>
      <AutoRefresh intervalMs={30000} />
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Sent today" value={sentToday[0]?.value ?? 0} color="text-blue-600" />
        <StatCard label="Received today" value={receivedToday[0]?.value ?? 0} color="text-green-600" />
        <StatCard label="Failed today" value={failedToday[0]?.value ?? 0} color="text-red-500" />
        <StatCard label="In progress" value={inProgress[0]?.value ?? 0} color="text-yellow-500" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Recent Activity</h2>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">No fax activity yet.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentActivity.map((fax) => (
              <Link
                key={fax.id}
                href={`/faxes/${fax.id}`}
                className="flex items-center gap-4 py-3 hover:bg-gray-50 -mx-2 px-2 rounded"
              >
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                  fax.direction === "inbound"
                    ? "bg-green-50 text-green-700"
                    : "bg-blue-50 text-blue-700"
                }`}>
                  {fax.direction === "inbound" ? "Received" : "Sent"}
                </span>
                <span className="font-mono text-xs text-gray-700 w-32 shrink-0">
                  {fax.direction === "inbound" ? fax.fromNumber : fax.toNumber}
                </span>
                {fax.subject && (
                  <span className="text-xs text-gray-500 flex-1 truncate">{fax.subject}</span>
                )}
                <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">{formatDate(fax.createdAt)}</span>
                <StatusBadge status={fax.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
