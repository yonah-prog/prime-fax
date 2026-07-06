"use client"

import { useEffect, useState } from "react"
import type { AvailableNumber } from "@/lib/telnyx"

type Tab = "add-existing" | "provision"
type DetailTab = "users" | "coversheet" | "settings"

interface NumberWithCounts {
  id: string
  number: string
  label: string | null
  deptName?: string | null
  telnyxNumberId?: string | null
  active: boolean
  isDefault: boolean
  coverSheetTemplateId?: string | null
  inboundDriveFolder?: string | null
  forwardToNumber?: string | null
  notifyEmail?: string | null
  createdAt: Date
  numUsersAssigned: number
  numUsersCanAccess: number
}

interface TemplateOption {
  id: string
  name: string
  isDefault: boolean
}

interface UserRow {
  id: string
  name: string
  email: string
  role: string
  hasAccess: boolean
}

export default function NumberManager() {
  const [numbers, setNumbers] = useState<NumberWithCounts[]>([])
  const [loading, setLoading] = useState(true)
  const [showPanel, setShowPanel] = useState(false)
  const [tab, setTab] = useState<Tab>("add-existing")

  // Add-existing form
  const [newNumber, setNewNumber] = useState("")
  const [newLabel, setNewLabel] = useState("")
  const [addingExisting, setAddingExisting] = useState(false)

  // Provision form
  const [areaCode, setAreaCode] = useState("")
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<AvailableNumber[]>([])
  const [searchError, setSearchError] = useState("")
  const [provisioning, setProvisioning] = useState<string | null>(null)
  const [provisionLabel, setProvisionLabel] = useState("")

  // Edit label inline
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState("")

  // Edit dept inline
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null)
  const [editDept, setEditDept] = useState("")

  // Inline cover-sheet template assignment (per row)
  const [savingCoverId, setSavingCoverId] = useState<string | null>(null)

  // User assignment panel
  const [selectedNumber, setSelectedNumber] = useState<NumberWithCounts | null>(null)
  const [numberUsers, setNumberUsers] = useState<UserRow[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  // Detail panel tab
  const [detailTab, setDetailTab] = useState<DetailTab>("users")

  // Cover sheet template association
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [savingTemplate, setSavingTemplate] = useState(false)

  // Per-number settings: inbound Google Drive folder + forwarding + email
  const [inboundFolder, setInboundFolder] = useState<string>("")
  const [forwardTo, setForwardTo] = useState<string>("")
  const [notifyEmail, setNotifyEmail] = useState<string>("")
  const [savingSettings, setSavingSettings] = useState(false)

  // Account-level Google Drive connection (admin)
  const [drive, setDrive] = useState<{ configured: boolean; connected: boolean } | null>(null)
  const [driveBusy, setDriveBusy] = useState(false)

  const [error, setError] = useState("")

  async function load() {
    setLoading(true)
    const res = await fetch("/api/numbers")
    if (res.ok) setNumbers(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    fetch("/api/templates").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setTemplates(data.map((t: { id: string; name: string; isDefault: boolean }) => ({ id: t.id, name: t.name, isDefault: t.isDefault })))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    fetch("/api/settings/google").then((r) => r.json())
      .then((d) => setDrive({ configured: !!d.configured, connected: !!d.connected }))
      .catch(() => setDrive({ configured: false, connected: false }))
  }, [])

  async function disconnectDrive() {
    setDriveBusy(true)
    await fetch("/api/settings/google", { method: "DELETE" }).catch(() => {})
    setDriveBusy(false)
    setDrive((d) => d ? { ...d, connected: false } : d)
  }

  async function loadUsers(number: NumberWithCounts) {
    setSelectedNumber(number)
    setSelectedTemplateId(number.coverSheetTemplateId ?? "")
    setInboundFolder(number.inboundDriveFolder ?? "")
    setForwardTo(number.forwardToNumber ?? "")
    setNotifyEmail(number.notifyEmail ?? "")
    setDetailTab("users")
    setShowPanel(false)
    setUsersLoading(true)
    const res = await fetch(`/api/numbers/${number.id}/users`)
    if (res.ok) setNumberUsers(await res.json())
    setUsersLoading(false)
  }

  async function saveCoverSheetTemplate(numberId: string) {
    setSavingTemplate(true)
    await fetch(`/api/numbers/${numberId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coverSheetTemplateId: selectedTemplateId || null }),
    })
    setSavingTemplate(false)
    await load()
    if (selectedNumber) {
      setSelectedNumber((prev) => prev ? { ...prev, coverSheetTemplateId: selectedTemplateId || null } : prev)
    }
  }

  async function saveSettings(numberId: string) {
    setSavingSettings(true)
    const inboundVal = inboundFolder.trim() || null
    const forwardVal = forwardTo.trim() || null
    const notifyVal = notifyEmail.trim() || null
    await fetch(`/api/numbers/${numberId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inboundDriveFolder: inboundVal, forwardToNumber: forwardVal, notifyEmail: notifyVal }),
    })
    setSavingSettings(false)
    await load()
    if (selectedNumber) {
      setSelectedNumber((prev) => prev ? { ...prev, inboundDriveFolder: inboundVal, forwardToNumber: forwardVal, notifyEmail: notifyVal } : prev)
    }
  }

  async function toggleAccess(userId: string, currentAccess: boolean) {
    setToggling(userId)
    await fetch(`/api/numbers/${selectedNumber!.id}/users`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, access: !currentAccess }),
    })
    setNumberUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, hasAccess: !currentAccess } : u))
    )
    setToggling(null)
  }

  async function setDefault(id: string) {
    await fetch(`/api/numbers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    })
    await load()
  }

  async function saveLabel(id: string) {
    await fetch(`/api/numbers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: editLabel }),
    })
    setEditingId(null)
    await load()
  }

  async function saveDept(id: string) {
    await fetch(`/api/numbers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deptName: editDept.trim() || null }),
    })
    setEditingDeptId(null)
    await load()
  }

  async function saveCoverInline(id: string, value: string) {
    setSavingCoverId(id)
    await fetch(`/api/numbers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coverSheetTemplateId: value || null }),
    })
    setSavingCoverId(null)
    await load()
    if (selectedNumber?.id === id) {
      setSelectedTemplateId(value)
      setSelectedNumber((prev) => prev ? { ...prev, coverSheetTemplateId: value || null } : prev)
    }
  }

  async function removeNumber(id: string, hasTelnyxId: boolean) {
    const release = hasTelnyxId && confirm("Also release this number from Telnyx? Click Cancel to just remove it locally.")
    await fetch(`/api/numbers/${id}?release=${release}`, { method: "DELETE" })
    if (selectedNumber?.id === id) setSelectedNumber(null)
    await load()
  }

  async function addExisting() {
    if (!newNumber.trim()) { setError("Enter a phone number"); return }
    setAddingExisting(true)
    setError("")
    const res = await fetch("/api/numbers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: newNumber.trim(), label: newLabel.trim() || null, isDefault: numbers.length === 0 }),
    })
    if (res.ok) {
      setNewNumber("")
      setNewLabel("")
      setShowPanel(false)
      await load()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? "Failed to add number")
    }
    setAddingExisting(false)
  }

  async function searchNumbers() {
    if (areaCode.length !== 3) { setSearchError("Enter a 3-digit area code"); return }
    setSearching(true)
    setSearchError("")
    setSearchResults([])
    const res = await fetch(`/api/numbers/search?areaCode=${areaCode}`)
    if (res.ok) {
      const data = await res.json()
      setSearchResults(data)
      if (data.length === 0) setSearchError("No fax-enabled numbers found for that area code. Try another.")
    } else {
      const data = await res.json().catch(() => ({}))
      setSearchError(data.error ?? "Search failed")
    }
    setSearching(false)
  }

  async function provision(phoneNumber: string) {
    setProvisioning(phoneNumber)
    const res = await fetch("/api/numbers/provision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, label: provisionLabel.trim() || null }),
    })
    if (res.ok) {
      setSearchResults([])
      setAreaCode("")
      setProvisionLabel("")
      setShowPanel(false)
      await load()
    } else {
      const data = await res.json().catch(() => ({}))
      setSearchError(data.error ?? "Provision failed")
    }
    setProvisioning(null)
  }

  const tabCls = (t: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`

  return (
    <div>
      {/* Account-level Google Drive connection (admin) */}
      {drive && (
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <div>
                <p className="text-sm font-semibold text-gray-900">Google Drive</p>
                <p className="text-xs text-gray-500">Inbound faxes are saved into each number&apos;s Drive folder automatically.</p>
              </div>
            </div>
            {!drive.configured ? (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 shrink-0">Not configured</span>
            ) : drive.connected ? (
              <div className="flex items-center gap-3 shrink-0">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" /> Connected
                </span>
                <button onClick={disconnectDrive} disabled={driveBusy} className="text-xs text-red-600 hover:underline disabled:opacity-50">Disconnect</button>
              </div>
            ) : (
              <a href="/api/auth/google" className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shrink-0">
                Connect Google Drive
              </a>
            )}
          </div>

          {/* Setup instructions when not yet working */}
          {(!drive.configured || !drive.connected) && (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
              {!drive.configured && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  <strong>Missing env vars:</strong> Set <code className="bg-amber-100 px-1 rounded">GOOGLE_CLIENT_ID</code> and <code className="bg-amber-100 px-1 rounded">GOOGLE_CLIENT_SECRET</code> in Railway, then redeploy.
                </p>
              )}
              <div>
                <p className="text-xs text-gray-500 mb-1">
                  Add this <strong>exact Authorized Redirect URI</strong> in{" "}
                  <span className="font-medium text-gray-700">Google Cloud Console → APIs &amp; Services → Credentials → OAuth 2.0 Client</span>:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded px-3 py-1.5 font-mono text-gray-800 select-all">
                    {(typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app.railway.app")).replace(/\/$/, "")}
                    /api/auth/google/callback
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      const base = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? "")
                      navigator.clipboard.writeText(`${base.replace(/\/$/, "")}/api/auth/google/callback`).catch(() => {})
                    }}
                    className="text-xs text-blue-600 hover:underline shrink-0"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  It must match character-for-character (scheme, host, no trailing slash).
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-6">
      {/* Number list */}
      <div className="flex-1 min-w-0">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">{numbers.length} number{numbers.length !== 1 ? "s" : ""}</span>
            <button
              onClick={() => { setShowPanel(true); setSelectedNumber(null); setError(""); setSearchResults([]); setSearchError("") }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              + Add Number
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
          ) : numbers.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">No numbers configured. Add or provision one to get started.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide text-left">
                  <th className="px-5 py-3">Number</th>
                  <th className="px-5 py-3">Label</th>
                  <th className="px-5 py-3">Dept</th>
                  <th className="px-5 py-3">Cover Sheet</th>
                  <th className="px-5 py-3">Users Assigned</th>
                  <th className="px-5 py-3">Users w/ Access</th>
                  <th className="px-5 py-3">Default</th>
                  <th className="px-5 py-3">Access</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {numbers.map((n) => {
                  const isSelected = selectedNumber?.id === n.id && !showPanel
                  return (
                    <tr
                      key={n.id}
                      className={`hover:bg-gray-50 cursor-pointer ${isSelected ? "bg-blue-50 hover:bg-blue-50" : ""}`}
                      onClick={() => loadUsers(n)}
                    >
                      <td className="px-5 py-3 font-mono text-gray-900">{n.number}</td>
                      <td className="px-5 py-3 text-gray-600" onClick={(e) => e.stopPropagation()}>
                        {editingId === n.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              autoFocus
                              value={editLabel}
                              onChange={(e) => setEditLabel(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") saveLabel(n.id); if (e.key === "Escape") setEditingId(null) }}
                              className="px-2 py-1 border border-gray-300 rounded text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button onClick={() => saveLabel(n.id)} className="text-xs text-blue-600 hover:underline">Save</button>
                            <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingId(n.id); setEditLabel(n.label ?? "") }}
                            className="text-gray-600 hover:text-gray-900 hover:underline"
                          >
                            {n.label || <span className="text-gray-300 italic">Add label</span>}
                          </button>
                        )}
                      </td>
                      {/* Dept column */}
                      <td className="px-5 py-3 text-gray-600" onClick={(e) => e.stopPropagation()}>
                        {editingDeptId === n.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              autoFocus
                              value={editDept}
                              onChange={(e) => setEditDept(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") saveDept(n.id); if (e.key === "Escape") setEditingDeptId(null) }}
                              className="px-2 py-1 border border-gray-300 rounded text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button onClick={() => saveDept(n.id)} className="text-xs text-blue-600 hover:underline">Save</button>
                            <button onClick={() => setEditingDeptId(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingDeptId(n.id); setEditDept(n.deptName ?? "") }}
                            className="text-gray-600 hover:text-gray-900 hover:underline"
                          >
                            {n.deptName || <span className="text-gray-300 italic">Add dept</span>}
                          </button>
                        )}
                      </td>
                      {/* Cover Sheet column */}
                      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={n.coverSheetTemplateId ?? ""}
                            onChange={(e) => saveCoverInline(n.id, e.target.value)}
                            disabled={savingCoverId === n.id || templates.length === 0}
                            className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 max-w-[160px]"
                          >
                            <option value="">{templates.length === 0 ? "No templates" : "— None —"}</option>
                            {templates.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}{t.isDefault ? " (default)" : ""}</option>
                            ))}
                          </select>
                          {savingCoverId === n.id && (
                            <svg className="w-3.5 h-3.5 text-gray-400 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-sm">{n.numUsersAssigned ?? 0}</td>
                      <td className="px-5 py-3 text-gray-500 text-sm">{n.numUsersCanAccess ?? 0}</td>
                      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                        {n.isDefault ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">Default</span>
                        ) : (
                          <button onClick={() => setDefault(n.id)} className="text-xs text-gray-400 hover:text-blue-600 hover:underline">Set default</button>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                          isSelected ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                        }`}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                          </svg>
                          Manage
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => removeNumber(n.id, !!n.telnyxNumberId)} className="text-sm text-red-500 hover:underline">Remove</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Right panel — user assignment or add number */}
      {(showPanel || selectedNumber) && (
        <div className="w-96 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-0">

            {/* Add number panel */}
            {showPanel && (
              <>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-900">Add Number</h2>
                  <button onClick={() => setShowPanel(false)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="flex border-b border-gray-100">
                  <button className={tabCls("provision")} onClick={() => setTab("provision")}>Find & Provision</button>
                  <button className={tabCls("add-existing")} onClick={() => setTab("add-existing")}>Add Existing</button>
                </div>

                <div className="p-5 space-y-4">
                  {tab === "add-existing" && (
                    <>
                      <p className="text-xs text-gray-500">Add a number you already own in Telnyx or HumbleFax. It won&apos;t be provisioned — just registered here for use.</p>
                      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                        <input type="tel" value={newNumber} onChange={(e) => setNewNumber(e.target.value)} placeholder="+12125551234" className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Label <span className="text-gray-400 font-normal">(optional)</span></label>
                        <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Main office fax" className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <button onClick={addExisting} disabled={addingExisting} className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                        {addingExisting ? "Adding…" : "Add Number"}
                      </button>
                    </>
                  )}

                  {tab === "provision" && (
                    <>
                      <p className="text-xs text-gray-500">Search for available fax numbers by area code and provision one directly through Telnyx.</p>
                      {searchError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{searchError}</p>}
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Area Code</label>
                          <input
                            type="text"
                            maxLength={3}
                            value={areaCode}
                            onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, ""))}
                            onKeyDown={(e) => { if (e.key === "Enter") searchNumbers() }}
                            placeholder="212"
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex items-end">
                          <button onClick={searchNumbers} disabled={searching} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 text-sm font-medium rounded-lg transition-colors">
                            {searching ? "…" : "Search"}
                          </button>
                        </div>
                      </div>

                      {searchResults.length > 0 && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Label <span className="text-gray-400 font-normal">(optional)</span></label>
                            <input type="text" value={provisionLabel} onChange={(e) => setProvisionLabel(e.target.value)} placeholder="Main office fax" className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
                            {searchResults.map((n) => (
                              <div key={n.phone_number} className="flex items-center justify-between px-3 py-2.5">
                                <span className="font-mono text-sm text-gray-900">{n.phone_number}</span>
                                <button
                                  onClick={() => provision(n.phone_number)}
                                  disabled={provisioning === n.phone_number}
                                  className="text-xs px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded transition-colors"
                                >
                                  {provisioning === n.phone_number ? "…" : "Provision"}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}

            {/* Number detail panel */}
            {!showPanel && selectedNumber && (
              <>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 font-mono truncate">{selectedNumber.number}</p>
                    {selectedNumber.label && <p className="text-xs text-gray-400 truncate">{selectedNumber.label}</p>}
                  </div>
                  <button onClick={() => setSelectedNumber(null)} className="text-gray-400 hover:text-gray-600 shrink-0 ml-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Detail tabs */}
                <div className="flex border-b border-gray-100">
                  <button
                    className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${detailTab === "users" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                    onClick={() => setDetailTab("users")}
                  >
                    User Access
                  </button>
                  <button
                    className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${detailTab === "coversheet" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                    onClick={() => setDetailTab("coversheet")}
                  >
                    Cover Sheet
                    {selectedNumber.coverSheetTemplateId && (
                      <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-blue-500 align-middle" />
                    )}
                  </button>
                  <button
                    className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${detailTab === "settings" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                    onClick={() => setDetailTab("settings")}
                  >
                    Settings
                    {(selectedNumber.inboundDriveFolder || selectedNumber.forwardToNumber || selectedNumber.notifyEmail) && (
                      <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-blue-500 align-middle" />
                    )}
                  </button>
                </div>

                {/* User Access tab */}
                {detailTab === "users" && (
                  <div className="p-4">
                    <p className="text-xs text-gray-500 mb-3">
                      Choose which users can send faxes from this number.
                    </p>
                    {usersLoading ? (
                      <div className="py-8 text-center text-sm text-gray-400">Loading users…</div>
                    ) : numberUsers.length === 0 ? (
                      <div className="py-8 text-center text-sm text-gray-400">No users found.</div>
                    ) : (
                      <div className="space-y-1">
                        {numberUsers.map((u) => (
                          <label
                            key={u.id}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                              u.hasAccess ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-gray-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={u.hasAccess}
                              disabled={toggling === u.id}
                              onChange={() => toggleAccess(u.id, u.hasAccess)}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                              <p className="text-xs text-gray-500 truncate">{u.email}</p>
                            </div>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
                              u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"
                            }`}>
                              {u.role}
                            </span>
                            {toggling === u.id && (
                              <svg className="w-3.5 h-3.5 text-gray-400 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            )}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Cover Sheet tab */}
                {detailTab === "coversheet" && (
                  <div className="p-4 space-y-4">
                    <p className="text-xs text-gray-500">
                      Associate a cover sheet template with this number. When users send from this number, they can use this template as their default cover sheet.
                    </p>
                    {templates.length === 0 ? (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                        No templates yet. Create one in <a href="/templates" className="underline">Cover Sheet Templates</a>.
                      </p>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1.5">Cover Sheet Template</label>
                          <select
                            value={selectedTemplateId}
                            onChange={(e) => setSelectedTemplateId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">— None —</option>
                            {templates.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}{t.isDefault ? " (default)" : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={() => saveCoverSheetTemplate(selectedNumber.id)}
                          disabled={savingTemplate}
                          className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          {savingTemplate ? "Saving…" : "Save Association"}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Settings tab */}
                {detailTab === "settings" && (
                  <div className="p-4 space-y-5">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Notify email</label>
                      <p className="text-xs text-gray-500 mb-2">
                        Inbound faxes to this number trigger an email to this address. Overrides the global notification setting.
                        Leave blank to use the system default.
                      </p>
                      <input
                        type="email"
                        value={notifyEmail}
                        onChange={(e) => setNotifyEmail(e.target.value)}
                        placeholder="e.g. inbox@yourpractice.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Forward incoming faxes to</label>
                      <p className="text-xs text-gray-500 mb-2">
                        Faxes received on this number are automatically forwarded to this outside fax number.
                        Leave blank to disable forwarding.
                      </p>
                      <input
                        type="tel"
                        value={forwardTo}
                        onChange={(e) => setForwardTo(e.target.value)}
                        placeholder="+1 555 123 4567"
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Inbound Google Drive folder</label>
                      <p className="text-xs text-gray-500 mb-2">
                        Faxes <strong>received</strong> on this number are saved to this folder in the connected
                        Google Drive (created if it doesn&apos;t exist). Leave blank to use the default folder.
                      </p>
                      <input
                        type="text"
                        value={inboundFolder}
                        onChange={(e) => setInboundFolder(e.target.value)}
                        placeholder="e.g. Faxes / Main Office / Received"
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {drive && drive.configured && !drive.connected && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                        Google Drive isn&apos;t connected — connect it at the top of this page for these folders to take effect.
                      </p>
                    )}

                    <button
                      onClick={() => saveSettings(selectedNumber.id)}
                      disabled={savingSettings}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      {savingSettings ? "Saving…" : "Save Settings"}
                    </button>
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      )}
      </div>
    </div>
  )
}
