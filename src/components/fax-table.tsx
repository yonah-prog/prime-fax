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

function PhoneCell({ num }: { num: string | null }) {
  const parsed = formatPhone(num)
  if (!parsed) return <span className="text-gray-300">—</span>
  if (!parsed.area) return <span className="font-mono text-sm">{parsed.rest}</span>
  return (
    <span className="font-mono text-sm text-gray-900">
      <span className="font-bold">{parsed.area}</span> {parsed.rest}
    </span>
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
  }
  const labels: Record<string, string> = {
    queued: "Queued",
    sending: "Sending",
    delivered: "Success",
    failed: "Failed",
    received: "Success",
    scheduled: "Scheduled",
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
}

export default function FaxTable({ faxes, direction, emptyMessage, phoneLabels = {} }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const isTrash = direction === "trash"

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

  if (faxes.length === 0) {
    return <div className="text-center py-16 text-sm text-gray-400">{emptyMessage}</div>
  }

  const allSelected = faxes.length > 0 && selected.size === faxes.length
  const someSelected = selected.size > 0

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
              <th className="pb-3 pr-6">From</th>
              <th className="pb-3 pr-6">Caller ID</th>
              <th className="pb-3 pr-4">Destination</th>
              <th className="pb-3 text-right">Pages</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {faxes.map((fax) => {
              const isInbound = fax.direction === "inbound"
              const isUnread = isInbound && !fax.readAt
              const callerId = isInbound ? fax.fromName : null
              const toLabel = isInbound
                ? (phoneLabels[fax.toNumber] ?? null)
                : (fax.recipientName ?? null)

              return (
                <tr
                  key={fax.id}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${isUnread ? "bg-blue-50/40" : ""}`}
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
                  <td className="py-3 pr-6 whitespace-nowrap">
                    <PhoneCell num={fax.fromNumber} />
                  </td>
                  <td className="py-3 pr-6 text-gray-500 text-sm max-w-[140px] truncate">
                    {callerId ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <PhoneCell num={fax.toNumber} />
                    {toLabel && <div className="text-xs text-gray-400 mt-0.5">{toLabel}</div>}
                  </td>
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
