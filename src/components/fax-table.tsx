"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { useState, useRef, useEffect } from "react"
import { showToast } from "./toast"
import type { Fax } from "@/lib/db/schema"

function formatPhone(raw: string | null): { area: string; rest: string } | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, "").replace(/^1/, "")
  if (digits.length === 10)
    return { area: digits.slice(0, 3), rest: `${digits.slice(3, 6)} ${digits.slice(6)}` }
  return { area: "", rest: raw }
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function formatDay(d: Date | string) {
  const dt = new Date(d)
  const wd = dt.toLocaleDateString("en-US", { weekday: "short" })
  const mo = dt.toLocaleDateString("en-US", { month: "short" })
  return `${wd} ${mo} ${ordinal(dt.getDate())}`
}

function formatTime(d: Date | string) {
  return new Date(d)
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .toLowerCase()
    .replace(" ", "")
}

function PhoneCell({ num, label }: { num: string | null; label?: string | null }) {
  const parsed = formatPhone(num)
  if (!parsed) return <span className="text-gray-300">—</span>
  return (
    <div>
      {parsed.area ? (
        <span className="font-mono text-sm text-gray-900">
          <span className="font-bold">{parsed.area}</span> {parsed.rest}
        </span>
      ) : (
        <span className="font-mono text-sm">{parsed.rest}</span>
      )}
      {label && <div className="text-xs text-gray-400 mt-0.5">{label}</div>}
    </div>
  )
}

function StatusCell({ status, errorMessage }: { status: string; errorMessage?: string | null }) {
  const colors: Record<string, string> = {
    queued: "text-gray-500",
    sending: "text-blue-600",
    delivered: "text-green-700",
    failed: "text-red-500",
    received: "text-green-700",
    scheduled: "text-amber-600",
    cancelled: "text-red-400",
  }
  const labels: Record<string, string> = {
    queued: "Queued",
    sending: "Sending",
    delivered: "Success",
    failed: "Failed",
    received: "Success",
    scheduled: "Scheduled",
    cancelled: "Cancelled",
  }
  return (
    <div>
      <span className={`text-sm font-medium ${colors[status] ?? "text-gray-600"}`}>
        {labels[status] ?? status}
      </span>
      {errorMessage && (
        <div className="text-xs text-red-400 truncate max-w-[120px]" title={errorMessage}>
          {errorMessage}
        </div>
      )}
    </div>
  )
}

function ContextMenu({
  fax, isTrash, onTrash, onRestore, onDelete,
}: {
  fax: Fax; isTrash: boolean
  onTrash: () => void; onRestore: () => void; onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-gray-600 rounded hover:bg-gray-100 font-bold leading-none"
      >
        ⋮
      </button>
      {open && (
        <div className="absolute left-0 top-7 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
          <Link href={`/faxes/${fax.id}`} onClick={() => setOpen(false)}
            className="block px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
            View Details
          </Link>
          {fax.fileUrl && (
            <a href={fax.fileUrl} download={fax.fileName ?? true} onClick={() => setOpen(false)}
              className="block px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
              Download PDF
            </a>
          )}
          <div className="border-t border-gray-100 my-1" />
          {isTrash ? (
            <>
              <button onClick={() => { onRestore(); setOpen(false) }}
                className="block w-full text-left px-4 py-1.5 text-sm text-blue-600 hover:bg-gray-50">
                Restore
              </button>
              <button onClick={() => { onDelete(); setOpen(false) }}
                className="block w-full text-left px-4 py-1.5 text-sm text-red-600 hover:bg-gray-50">
                Delete permanently
              </button>
            </>
          ) : (
            <button onClick={() => { onTrash(); setOpen(false) }}
              className="block w-full text-left px-4 py-1.5 text-sm text-red-600 hover:bg-gray-50">
              Move to trash
            </button>
          )}
        </div>
      )}
    </div>
  )
}

interface Props {
  faxes: Fax[]
  direction: "inbound" | "outbound" | "trash" | "in-progress"
  emptyMessage: string
  phoneLabels?: Record<string, string>
  senders?: Record<string, { name: string; email: string }>
  imageView?: boolean
}

export default function FaxTable({
  faxes,
  direction,
  emptyMessage,
  phoneLabels = {},
  senders = {},
  imageView = false,
}: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const isTrash = direction === "trash"
  const isOutbound = direction === "outbound"

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(faxes.map((f) => f.id)) : new Set())
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function bulk(action: "trash" | "restore" | "delete") {
    if (action === "delete" && !confirm(`Permanently delete ${selected.size} fax(es)? This cannot be undone.`)) return
    setBusy(true)
    await fetch("/api/faxes/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected], action }),
    })
    setSelected(new Set())
    setBusy(false)
    showToast(`${selected.size} fax(es) ${action === "trash" ? "moved to trash" : action === "restore" ? "restored" : "deleted"}`)
    router.refresh()
  }

  async function singleAction(id: string, action: "trash" | "restore" | "delete") {
    if (action === "delete" && !confirm("Permanently delete this fax? This cannot be undone.")) return
    if (action === "delete") {
      await fetch(`/api/faxes/${id}`, { method: "DELETE" })
      showToast("Deleted", "error")
    } else {
      await fetch(`/api/faxes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      showToast(action === "trash" ? "Moved to trash" : "Restored")
    }
    router.refresh()
  }

  const allSelected = faxes.length > 0 && selected.size === faxes.length
  const someSelected = selected.size > 0

  if (imageView) {
    return (
      <div>
        {someSelected && (
          <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-sm">
            <span className="font-medium text-blue-700">{selected.size} selected</span>
            <div className="flex gap-2 ml-auto">
              {isTrash ? (
                <>
                  <button disabled={busy} onClick={() => bulk("restore")} className="px-3 py-1 rounded bg-white border border-gray-200 hover:bg-gray-50 text-blue-700 font-medium disabled:opacity-50 text-xs">Restore</button>
                  <button disabled={busy} onClick={() => bulk("delete")} className="px-3 py-1 rounded bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 text-xs">Delete</button>
                </>
              ) : (
                <button disabled={busy} onClick={() => bulk("trash")} className="px-3 py-1 rounded bg-white border border-gray-200 hover:bg-gray-50 text-red-600 font-medium disabled:opacity-50 text-xs">Move to trash</button>
              )}
            </div>
            <button onClick={() => setSelected(new Set())} className="text-gray-400 hover:text-gray-600 text-xs ml-1">✕</button>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 py-4">
          {faxes.map((fax) => {
            const isUnread = fax.direction === "inbound" && !fax.readAt
            const isSelected = selected.has(fax.id)
            return (
              <div
                key={fax.id}
                onClick={() => router.push(`/faxes/${fax.id}`)}
                className={`relative rounded-xl border cursor-pointer transition-all hover:shadow-md ${
                  isSelected ? "border-blue-400 ring-2 ring-blue-200" : "border-gray-200"
                } ${isUnread ? "bg-blue-50/30" : "bg-white"}`}
              >
                <div className="aspect-[8.5/11] bg-gray-50 rounded-t-xl flex items-center justify-center border-b border-gray-100 overflow-hidden">
                  {fax.fileUrl ? (
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <span className="text-xs font-medium">{fax.pages ?? "?"} page{(fax.pages ?? 0) !== 1 ? "s" : ""}</span>
                    </div>
                  ) : (
                    <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  )}
                </div>
                <div className="p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <StatusCell status={fax.status} />
                    <span className="text-[10px] text-gray-400">{formatTime(fax.createdAt)}</span>
                  </div>
                  <p className="text-xs font-mono text-gray-700 truncate">
                    {fax.direction === "inbound" ? fax.fromNumber : fax.toNumber}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{formatDay(fax.createdAt)}</p>
                </div>
                <div className="absolute top-2 left-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleOne(fax.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-white/80"
                  />
                </div>
                {isUnread && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-blue-500" />
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (faxes.length === 0) {
    return <div className="text-center py-16 text-sm text-gray-400">{emptyMessage}</div>
  }

  return (
    <div>
      {someSelected && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-sm">
          <span className="font-medium text-blue-700">{selected.size} selected</span>
          <div className="flex gap-2 ml-auto">
            {isTrash ? (
              <>
                <button disabled={busy} onClick={() => bulk("restore")} className="px-3 py-1 rounded bg-white border border-gray-200 hover:bg-gray-50 text-blue-700 font-medium disabled:opacity-50 text-xs">Restore</button>
                <button disabled={busy} onClick={() => bulk("delete")} className="px-3 py-1 rounded bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 text-xs">Delete</button>
              </>
            ) : (
              <button disabled={busy} onClick={() => bulk("trash")} className="px-3 py-1 rounded bg-white border border-gray-200 hover:bg-gray-50 text-red-600 font-medium disabled:opacity-50 text-xs">Move to trash</button>
            )}
          </div>
          <button onClick={() => setSelected(new Set())} className="text-gray-400 hover:text-gray-600 text-xs ml-1">✕</button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="pb-3 pr-2 w-6" />
              <th className="pb-3 pr-3 w-8">
                <input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} className="rounded" />
              </th>
              <th className="pb-3 pr-5">Date</th>
              <th className="pb-3 pr-5">Time</th>
              <th className="pb-3 pr-6">Status</th>
              {isOutbound ? (
                <>
                  <th className="pb-3 pr-6">Destination</th>
                  <th className="pb-3 pr-6">From</th>
                  <th className="pb-3 pr-6">Sender</th>
                  <th className="pb-3 pr-4">Subject</th>
                </>
              ) : (
                <>
                  <th className="pb-3 pr-6">From</th>
                  <th className="pb-3 pr-6">Caller ID</th>
                  <th className="pb-3 pr-4">Destination</th>
                </>
              )}
              <th className="pb-3 text-right">Pages</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {faxes.map((fax) => {
              const isInbound = fax.direction === "inbound"
              const isUnread = isInbound && !fax.readAt
              const isTrashed = !!fax.trashedAt
              const sender = fax.userId ? senders[fax.userId] : null

              return (
                <tr
                  key={fax.id}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${isUnread ? "bg-blue-50/40" : ""} ${isTrashed ? "opacity-60" : ""}`}
                  onClick={() => router.push(`/faxes/${fax.id}`)}
                >
                  <td className="py-3 pr-2" onClick={(e) => e.stopPropagation()}>
                    <ContextMenu
                      fax={fax}
                      isTrash={isTrash}
                      onTrash={() => singleAction(fax.id, "trash")}
                      onRestore={() => singleAction(fax.id, "restore")}
                      onDelete={() => singleAction(fax.id, "delete")}
                    />
                  </td>
                  <td className="py-3 pr-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      {isUnread && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                      <input type="checkbox" checked={selected.has(fax.id)} onChange={() => toggleOne(fax.id)} className="rounded" />
                    </div>
                  </td>
                  <td className="py-3 pr-5 whitespace-nowrap">
                    <span className={`text-sm ${isUnread ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                      {formatDay(fax.createdAt)}
                    </span>
                    {isTrashed && <div className="text-[10px] text-red-400 mt-0.5">Deleted</div>}
                  </td>
                  <td className="py-3 pr-5 whitespace-nowrap text-gray-500 text-sm">
                    {formatTime(fax.createdAt)}
                  </td>
                  <td className="py-3 pr-6">
                    <StatusCell status={fax.status} errorMessage={fax.errorMessage} />
                    {fax.scheduledAt && fax.status === "scheduled" && (
                      <div className="text-xs text-amber-500 mt-0.5">
                        {formatDay(fax.scheduledAt)} {formatTime(fax.scheduledAt)}
                      </div>
                    )}
                  </td>

                  {isOutbound ? (
                    <>
                      {/* Destination */}
                      <td className="py-3 pr-6 whitespace-nowrap">
                        <PhoneCell num={fax.toNumber} />
                        {fax.recipientName && <div className="text-xs text-gray-400 mt-0.5">{fax.recipientName}</div>}
                      </td>
                      {/* From (outgoing number + dept label) */}
                      <td className="py-3 pr-6 whitespace-nowrap">
                        <PhoneCell num={fax.fromNumber} label={phoneLabels[fax.fromNumber] ?? null} />
                      </td>
                      {/* Sender (user name + email) */}
                      <td className="py-3 pr-6">
                        {sender ? (
                          <div>
                            <p className="text-sm text-gray-900 font-medium">{sender.name}</p>
                            <p className="text-xs text-gray-400">{sender.email}</p>
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      {/* Subject */}
                      <td className="py-3 pr-4 text-gray-600 text-sm max-w-[160px] truncate">
                        {fax.subject || <span className="text-gray-300">—</span>}
                      </td>
                    </>
                  ) : (
                    <>
                      {/* From */}
                      <td className="py-3 pr-6 whitespace-nowrap">
                        <PhoneCell num={fax.fromNumber} />
                      </td>
                      {/* Caller ID */}
                      <td className="py-3 pr-6 text-gray-500 text-sm max-w-[140px] truncate">
                        {fax.fromName ?? <span className="text-gray-300">—</span>}
                      </td>
                      {/* Destination */}
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <PhoneCell num={fax.toNumber} label={phoneLabels[fax.toNumber] ?? null} />
                      </td>
                    </>
                  )}

                  <td className="py-3 text-right text-gray-700 font-medium">
                    {fax.pages ?? <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
