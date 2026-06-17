import { db } from "@/lib/db"
import { auditLogs } from "@/lib/db/schema"
import { desc } from "drizzle-orm"

export const dynamic = "force-dynamic"

function formatDate(d: Date | string) {
  return new Date(d).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  })
}

const actionLabels: Record<string, { label: string; color: string }> = {
  fax_sent: { label: "Sent", color: "text-blue-700 bg-blue-50" },
  fax_scheduled: { label: "Scheduled", color: "text-amber-700 bg-amber-50" },
  fax_retried: { label: "Retried", color: "text-orange-700 bg-orange-50" },
  fax_trashed: { label: "Trashed", color: "text-gray-700 bg-gray-100" },
  fax_restored: { label: "Restored", color: "text-green-700 bg-green-50" },
  fax_deleted: { label: "Deleted", color: "text-red-700 bg-red-50" },
  fax_bulk_trashed: { label: "Bulk Trash", color: "text-gray-700 bg-gray-100" },
  fax_bulk_restored: { label: "Bulk Restore", color: "text-green-700 bg-green-50" },
  fax_bulk_deleted: { label: "Bulk Delete", color: "text-red-700 bg-red-50" },
  user_created: { label: "User Created", color: "text-purple-700 bg-purple-50" },
  user_deleted: { label: "User Deleted", color: "text-red-700 bg-red-50" },
  password_reset: { label: "Password Reset", color: "text-yellow-700 bg-yellow-50" },
  role_changed: { label: "Role Changed", color: "text-indigo-700 bg-indigo-50" },
}

export default async function AuditLogPage() {
  const rows = await db.query.auditLogs.findMany({
    orderBy: [desc(auditLogs.createdAt)],
    limit: 200,
  })

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">
        Audit Log
        {rows.length > 0 && <span className="ml-2 text-sm font-normal text-gray-400">{rows.length} entries</span>}
      </h1>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {rows.length === 0 ? (
          <p className="text-sm text-gray-400 py-16 text-center">No activity recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-5 pb-3 pt-4">Time</th>
                  <th className="px-5 pb-3 pt-4">User</th>
                  <th className="px-5 pb-3 pt-4">Action</th>
                  <th className="px-5 pb-3 pt-4">Resource</th>
                  <th className="px-5 pb-3 pt-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row) => {
                  const badge = actionLabels[row.action] ?? { label: row.action, color: "text-gray-700 bg-gray-100" }
                  let meta: Record<string, unknown> = {}
                  try { meta = row.meta ? JSON.parse(row.meta) : {} } catch { /* ignore */ }
                  return (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                      <td className="px-5 py-3 text-xs text-gray-700">{row.userEmail ?? "—"}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500">
                        {row.resourceType && <span className="capitalize">{row.resourceType}</span>}
                        {row.resourceId && <span className="font-mono text-gray-400 ml-1 text-[10px]"> #{row.resourceId.slice(0, 8)}</span>}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-400 max-w-xs truncate">
                        {Object.entries(meta).map(([k, v]) => `${k}: ${v}`).join(" · ") || "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
