"use client"

import { useState } from "react"
import type { BlockedNumber } from "@/lib/db/schema"

interface Props {
  initial: BlockedNumber[]
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function SpamManager({ initial }: Props) {
  const [rows, setRows] = useState(initial)
  const [number, setNumber] = useState("")
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function add() {
    if (!number.trim()) { setError("Phone number is required."); return }
    setSaving(true); setError(null)
    const res = await fetch("/api/admin/spam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: number.trim(), reason: reason.trim() || null }),
    })
    setSaving(false)
    if (res.status === 409) { setError("That number is already blocked."); return }
    if (!res.ok) { setError("Failed to save."); return }
    const row: BlockedNumber = await res.json()
    setRows([row, ...rows])
    setNumber(""); setReason("")
  }

  async function remove(id: string) {
    await fetch(`/api/admin/spam/${id}`, { method: "DELETE" })
    setRows(rows.filter((r) => r.id !== id))
  }

  return (
    <div>
      {/* Add form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Block a number</h2>
        <div className="flex flex-wrap gap-3">
          <input
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="flex-1 min-w-48 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="flex-1 min-w-48 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={add}
            disabled={saving}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-60"
          >
            {saving ? "Blocking…" : "Block Number"}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

      {/* Blocked list */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          Blocked numbers {rows.length > 0 && <span className="font-normal text-gray-400 ml-1">({rows.length})</span>}
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">No numbers blocked yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="pb-3 pr-6">Number</th>
                  <th className="pb-3 pr-6">Reason</th>
                  <th className="pb-3 pr-6">Blocked</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="py-3 pr-6 font-mono text-xs text-gray-900">{row.number}</td>
                    <td className="py-3 pr-6 text-gray-500">{row.reason ?? <span className="text-gray-300">—</span>}</td>
                    <td className="py-3 pr-6 text-xs text-gray-400">{formatDate(row.createdAt)}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => remove(row.id)}
                        className="text-xs text-gray-400 hover:text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
