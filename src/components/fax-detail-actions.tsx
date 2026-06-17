"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { useState, useEffect } from "react"
import { showToast } from "./toast"

interface Props {
  fax: {
    id: string
    status: string
    direction: string
    fileUrl: string | null
    fileName: string | null
    readAt: string | null
    notes: string | null
    toNumber: string
  }
}

export default function FaxDetailActions({ fax }: Props) {
  const router = useRouter()
  const [retrying, setRetrying] = useState(false)
  const [notes, setNotes] = useState(fax.notes ?? "")
  const [savingNotes, setSavingNotes] = useState(false)
  const [isRead, setIsRead] = useState(!!fax.readAt)

  // Auto-mark inbound faxes as read when detail page is opened
  useEffect(() => {
    if (fax.direction === "inbound" && !fax.readAt) {
      fetch(`/api/faxes/${fax.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read" }),
      }).then(() => setIsRead(true))
    }
  }, [fax.id, fax.direction, fax.readAt])

  async function retry() {
    setRetrying(true)
    const res = await fetch(`/api/faxes/${fax.id}/retry`, { method: "POST" })
    setRetrying(false)
    if (res.ok) {
      showToast("Fax queued for retry")
      router.refresh()
    } else {
      showToast("Retry failed", "error")
    }
  }

  async function toggleRead() {
    const action = isRead ? "unread" : "read"
    await fetch(`/api/faxes/${fax.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    setIsRead(!isRead)
    showToast(action === "read" ? "Marked as read" : "Marked as unread")
    router.refresh()
  }

  async function saveNotes() {
    setSavingNotes(true)
    await fetch(`/api/faxes/${fax.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "notes", notes }),
    })
    setSavingNotes(false)
    showToast("Notes saved")
  }

  return (
    <div className="w-full">
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        {fax.direction === "inbound" && (
          <button onClick={toggleRead}
            className="text-xs px-3 py-1.5 rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium">
            {isRead ? "Mark Unread" : "Mark Read"}
          </button>
        )}

        {fax.direction === "outbound" && (
          <Link href={`/send?resend=${fax.id}`}
            className="text-xs px-3 py-1.5 rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium">
            Resend
          </Link>
        )}

        {fax.status === "failed" && (
          <button onClick={retry} disabled={retrying}
            className="text-xs px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-white font-medium disabled:opacity-60">
            {retrying ? "Retrying…" : "Retry"}
          </button>
        )}
      </div>

      {/* Notes */}
      <div className="mt-2">
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Internal Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Add internal notes about this fax…"
          className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
        <button
          onClick={saveNotes}
          disabled={savingNotes}
          className="mt-1.5 text-xs px-3 py-1.5 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60"
        >
          {savingNotes ? "Saving…" : "Save Notes"}
        </button>
      </div>
    </div>
  )
}
