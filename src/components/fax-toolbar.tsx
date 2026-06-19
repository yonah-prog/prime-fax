"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useCallback, useTransition } from "react"

function IcoCalendar() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="4" width="16" height="14" rx="2" />
      <path d="M2 8h16M7 2v4M13 2v4" strokeLinecap="round" />
    </svg>
  )
}

function IcoHideFailed() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="10" cy="10" r="7.5" />
      <path d="M7.5 7.5l5 5M12.5 7.5l-5 5" strokeLinecap="round" />
    </svg>
  )
}

function IcoUnread() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="5" width="16" height="12" rx="2" />
      <path d="M2 7l8 5 8-5" strokeLinecap="round" />
    </svg>
  )
}

function IcoImage() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="16" height="14" rx="2" />
      <circle cx="7.5" cy="8" r="1.5" />
      <path d="M2 14l4-4 3 3 2-2 5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IcoDownload() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 3v10M6.5 9.5l3.5 3.5 3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 16h14" strokeLinecap="round" />
    </svg>
  )
}

function IcoTrash() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3.5 6h13M8 6V4h4v2M5 6l.9 10a1 1 0 001 .95h6.2a1 1 0 001-.95L15 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IcoRestore() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 10a6 6 0 106-6H7" strokeLinecap="round" />
      <path d="M4 6v4h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Btn({
  icon, label, count, active, danger, onClick,
}: {
  icon: React.ReactNode
  label: string
  count?: number
  active?: boolean
  danger?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-[68px]
        ${active ? "bg-blue-50 text-blue-600 hover:bg-blue-100" : danger ? "text-red-500 hover:bg-red-50 hover:text-red-600" : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"}`}
    >
      <div className="relative">
        {icon}
        {typeof count === "number" && count > 0 && (
          <span className="absolute -top-1.5 -right-2 bg-blue-500 text-white text-[10px] font-bold rounded-full min-w-[17px] h-[17px] flex items-center justify-center px-0.5 leading-none">
            {count > 9999 ? "9k+" : count}
          </span>
        )}
      </div>
      <span className="text-[11px] font-medium whitespace-nowrap">{label}</span>
    </button>
  )
}

const SORT_OPTIONS = [
  { value: "date_desc", label: "Fax Date (newest)" },
  { value: "date_asc", label: "Fax Date (oldest)" },
  { value: "status", label: "Status" },
  { value: "pages", label: "Pages" },
  { value: "to_number", label: "To Number" },
  { value: "subject", label: "Subject" },
  { value: "from_number", label: "From Number" },
]

interface Props {
  failedCount?: number
  unreadCount?: number
  total?: number
  totalFaxPages?: number
  isTrash?: boolean
  showDeletedToggle?: boolean
  phoneNumbers?: { number: string; label: string | null }[]
  users?: { id: string; name: string; email?: string }[]
}

export default function FaxToolbar({
  failedCount = 0,
  unreadCount = 0,
  total = 0,
  totalFaxPages = 0,
  isTrash = false,
  showDeletedToggle = false,
  phoneNumbers = [],
  users = [],
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const hideFailed = searchParams.get("hideFailed") === "1"
  const unreadOnly = searchParams.get("unread") === "1"
  const showDateRange = searchParams.get("dateRange") === "1"
  const selectedNumber = searchParams.get("number") ?? ""
  const selectedUserId = searchParams.get("userId") ?? ""
  const imageView = searchParams.get("imageView") === "1"
  const sortBy = searchParams.get("sortBy") ?? "date_desc"
  const showDeleted = searchParams.get("showDeleted") === "1"

  const update = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      params.delete("page")
      startTransition(() => router.push(`${pathname}?${params.toString()}`))
    },
    [router, pathname, searchParams]
  )

  function toggle(key: string, val: string) {
    update(key, searchParams.get(key) === val ? null : val)
  }

  const hasFilters =
    searchParams.get("q") ||
    searchParams.get("from") ||
    searchParams.get("to") ||
    searchParams.get("hideFailed") ||
    searchParams.get("unread") ||
    searchParams.get("number") ||
    searchParams.get("userId") ||
    searchParams.get("showDeleted")

  return (
    <div className="mb-4 space-y-2">
      {/* Icon button row */}
      <div className="flex items-center gap-0.5 flex-wrap border-b border-gray-100 pb-2">
        <Btn icon={<IcoCalendar />} label="Date Range" active={showDateRange} onClick={() => toggle("dateRange", "1")} />
        <Btn icon={<IcoHideFailed />} label="Hide Failed" count={failedCount} active={hideFailed} onClick={() => toggle("hideFailed", "1")} />
        <Btn icon={<IcoImage />} label="Image View" active={imageView} onClick={() => toggle("imageView", "1")} />
        <Btn icon={<IcoUnread />} label="Unread Only" count={unreadCount} active={unreadOnly} onClick={() => toggle("unread", "1")} />
        <Btn icon={<IcoDownload />} label="Download All" />
        {isTrash ? (
          <>
            <Btn icon={<IcoTrash />} label="Delete All" danger />
            <Btn icon={<IcoRestore />} label="Restore All" />
          </>
        ) : (
          <Btn icon={<IcoTrash />} label="Trash All" danger count={total > 0 ? total : undefined} />
        )}
      </div>

      {/* Date range inputs */}
      {showDateRange && (
        <div className="flex items-center gap-3 px-1 py-2 bg-gray-50 rounded-lg border border-gray-100">
          <label className="text-xs text-gray-500 font-medium">From</label>
          <input
            type="date"
            defaultValue={searchParams.get("from") ?? ""}
            onChange={(e) => update("from", e.target.value || null)}
            className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <label className="text-xs text-gray-500 font-medium">To</label>
          <input
            type="date"
            defaultValue={searchParams.get("to") ?? ""}
            onChange={(e) => update("to", e.target.value || null)}
            className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Search + filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="search"
          placeholder="Search number or name…"
          defaultValue={searchParams.get("q") ?? ""}
          onChange={(e) => update("q", e.target.value || null)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
        />
        {phoneNumbers.length > 0 && (
          <select
            value={selectedNumber}
            onChange={(e) => update("number", e.target.value || null)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Numbers</option>
            {phoneNumbers.map((p) => (
              <option key={p.number} value={p.number}>
                {p.number}{p.label ? ` — ${p.label}` : ""}
              </option>
            ))}
          </select>
        )}
        {users.length > 0 && (
          <select
            value={selectedUserId}
            onChange={(e) => update("userId", e.target.value || null)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {(u.name || "Unnamed") + (u.email ? ` — ${u.email}` : "")}
              </option>
            ))}
          </select>
        )}

        {/* Sort by */}
        <select
          value={sortBy}
          onChange={(e) => update("sortBy", e.target.value === "date_desc" ? null : e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Show Deleted toggle */}
        {showDeletedToggle && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => toggle("showDeleted", "1")}
              className={`relative w-9 h-5 rounded-full transition-colors ${showDeleted ? "bg-blue-600" : "bg-gray-200"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showDeleted ? "translate-x-4" : ""}`} />
            </div>
            <span className="text-xs text-gray-500 font-medium">Show Deleted</span>
          </label>
        )}

        <span className="text-xs text-gray-400 ml-auto">
          {total.toLocaleString()} fax{total !== 1 ? "es" : ""}
          {totalFaxPages > 0 && ` · ${totalFaxPages.toLocaleString()} page${totalFaxPages !== 1 ? "s" : ""}`}
        </span>
        {hasFilters && (
          <button onClick={() => router.push(pathname)} className="text-xs text-gray-400 hover:text-gray-700 underline">
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}
