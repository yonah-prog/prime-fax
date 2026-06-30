"use client"

import { useState, Fragment } from "react"
import type { PhoneNumber, User } from "@/lib/db/schema"

type SafeUser = Omit<User, "passwordHash">

interface NumberRow extends PhoneNumber {
  hasAccess: boolean
}

interface NumberOption {
  id: string
  number: string
  label: string | null
  isDefault: boolean
}

interface Props {
  initial: SafeUser[]
  currentUserId: string
  numbers: NumberOption[]
}

export default function UserManager({ initial, currentUserId, numbers }: Props) {
  const [users, setUsers] = useState<SafeUser[]>(initial)
  const [form, setForm] = useState({ name: "", email: "", role: "staff" })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [resetId, setResetId] = useState<string | null>(null)
  const [resetPw, setResetPw] = useState("")
  const [resetError, setResetError] = useState<string | null>(null)

  // Number access panel
  const [selectedUser, setSelectedUser] = useState<SafeUser | null>(null)
  const [numberRows, setNumberRows] = useState<NumberRow[]>([])
  const [numbersLoading, setNumbersLoading] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  async function updateUser(id: string, patch: Partial<SafeUser>) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))
  }

  async function loadNumbers(user: SafeUser) {
    if (selectedUser?.id === user.id) {
      setSelectedUser(null)
      return
    }
    setSelectedUser(user)
    setNumbersLoading(true)
    const res = await fetch(`/api/admin/users/${user.id}/numbers`)
    if (res.ok) setNumberRows(await res.json())
    setNumbersLoading(false)
  }

  async function toggleNumber(phoneNumberId: string, currentAccess: boolean) {
    setToggling(phoneNumberId)
    const access = !currentAccess
    await fetch(`/api/admin/users/${selectedUser!.id}/numbers`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumberId, access }),
    })
    setNumberRows((rows) =>
      rows.map((r) => (r.id === phoneNumberId ? { ...r, hasAccess: access } : r))
    )
    setToggling(null)
  }

  async function addUser() {
    if (!form.name || !form.email) {
      setError("Name and email are required.")
      return
    }
    setSaving(true)
    setError(null)
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.status === 409) { setError("Email already exists."); return }
    if (!res.ok) { setError("Failed to create user."); return }
    const user: SafeUser = await res.json()
    setUsers([...users, user])
    setForm({ name: "", email: "", role: "staff" })
  }

  async function resetPassword() {
    if (!resetPw || resetPw.length < 8) {
      setResetError("Password must be at least 8 characters.")
      return
    }
    const res = await fetch(`/api/admin/users/${resetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: resetPw }),
    })
    if (!res.ok) { setResetError("Failed to reset password."); return }
    setResetId(null)
    setResetPw("")
    setResetError(null)
  }

  async function removeUser(id: string) {
    if (id === currentUserId) return
    if (!confirm("Remove this user? They will no longer be able to log in.")) return
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" })
    setUsers(users.filter((u) => u.id !== id))
    if (selectedUser?.id === id) setSelectedUser(null)
  }

  function accessCount(user: SafeUser) {
    return numberRows.length > 0 && selectedUser?.id === user.id
      ? numberRows.filter((r) => r.hasAccess).length
      : null
  }

  return (
    <div className="flex gap-6 items-start">
      <div className="flex-1 min-w-0">
        {/* Add user form */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Add New User</h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              type="text"
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="email"
              placeholder="Email address"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              onClick={addUser}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Creating…" : "Create User"}
            </button>
            <span className="text-xs text-gray-400">A temporary password will be emailed to the user.</span>
          </div>
        </div>

        {/* User table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 pb-3 pt-4 whitespace-nowrap">Name</th>
                  <th className="px-4 pb-3 pt-4 whitespace-nowrap">Email</th>
                  <th className="px-4 pb-3 pt-4 whitespace-nowrap">Role</th>
                  <th className="px-4 pb-3 pt-4 text-center whitespace-nowrap">Inbound</th>
                  <th className="px-4 pb-3 pt-4 text-center whitespace-nowrap">All Sent</th>
                  <th className="px-4 pb-3 pt-4 text-center whitespace-nowrap">Del Priv</th>
                  <th className="px-4 pb-3 pt-4 text-center whitespace-nowrap">Sec Mode</th>
                  <th className="px-4 pb-3 pt-4 text-center whitespace-nowrap">2FA</th>
                  <th className="px-4 pb-3 pt-4 text-center whitespace-nowrap">Lock</th>
                  <th className="px-4 pb-3 pt-4 whitespace-nowrap">Assigned #</th>
                  <th className="px-4 pb-3 pt-4 whitespace-nowrap">Num Access</th>
                  <th className="px-4 pb-3 pt-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(() => {
                  // Group users by assignedNumberId
                  const grouped = new Map<string | null, SafeUser[]>()
                  for (const u of users) {
                    const key = u.assignedNumberId ?? null
                    if (!grouped.has(key)) grouped.set(key, [])
                    grouped.get(key)!.push(u)
                  }
                  const assignedKeys = Array.from(grouped.keys())
                    .filter((k) => k !== null)
                    .sort((a, b) => {
                      const nA = numbers.find((n) => n.id === a)
                      const nB = numbers.find((n) => n.id === b)
                      return (nA?.label ?? nA?.number ?? "").localeCompare(nB?.label ?? nB?.number ?? "")
                    })
                  const orderedKeys = [...assignedKeys, null].filter((k) => grouped.has(k))

                  return orderedKeys.map((key) => {
                    const groupUsers = grouped.get(key) ?? []
                    const numInfo = key ? numbers.find((n) => n.id === key) : null
                    return (
                      <Fragment key={key ?? "unassigned"}>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <td colSpan={12} className="px-4 py-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                {numInfo ? (numInfo.label ?? numInfo.number) : "Unassigned"}
                              </span>
                              {numInfo?.label && (
                                <span className="text-xs font-mono text-gray-400">{numInfo.number}</span>
                              )}
                              <span className="text-xs text-gray-400">· {groupUsers.length} user{groupUsers.length !== 1 ? "s" : ""}</span>
                            </div>
                          </td>
                        </tr>
                        {groupUsers.map((user) => {
                  const isCurrentUser = user.id === currentUserId
                  const isSelected = selectedUser?.id === user.id
                  const count = accessCount(user)
                  return (
                    <tr
                      key={user.id}
                      className={`transition-colors ${
                        user.locked ? "opacity-60 bg-gray-50" : isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                      }`}
                    >
                      {/* Name */}
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          {user.locked && (
                            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          )}
                          {user.name}
                          {isCurrentUser && (
                            <span className="text-xs text-gray-400 font-normal">(you)</span>
                          )}
                        </span>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{user.email}</td>

                      {/* Role */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isCurrentUser ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                            user.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"
                          }`}>{user.role}</span>
                        ) : (
                          <select
                            value={user.role}
                            onChange={(e) => updateUser(user.id, { role: e.target.value as "admin" | "staff" })}
                            className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none"
                          >
                            <option value="staff">Staff</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                      </td>

                      {/* Inbound */}
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={user.canViewInbound}
                          onChange={(e) => updateUser(user.id, { canViewInbound: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      {/* All Sent */}
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={user.canViewAllSent}
                          onChange={(e) => updateUser(user.id, { canViewAllSent: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      {/* Del Priv */}
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={user.canDelete}
                          onChange={(e) => updateUser(user.id, { canDelete: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      {/* Sec Mode */}
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={user.secureMode}
                          onChange={(e) => updateUser(user.id, { secureMode: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      {/* 2FA */}
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={user.require2FA}
                          onChange={(e) => updateUser(user.id, { require2FA: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      {/* Lock */}
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={user.locked}
                          disabled={isCurrentUser}
                          onChange={(e) => updateUser(user.id, { locked: e.target.checked })}
                          className="rounded border-gray-300 text-red-500 focus:ring-red-400 disabled:opacity-40"
                        />
                      </td>

                      {/* Assigned # */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <select
                          value={user.assignedNumberId ?? ""}
                          onChange={(e) =>
                            updateUser(user.id, { assignedNumberId: e.target.value || null })
                          }
                          className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none max-w-[140px]"
                        >
                          <option value="">— none —</option>
                          {numbers.map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.label ?? n.number}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Num Access */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => loadNumbers(user)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600"
                              : "border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"
                          }`}
                        >
                          {isSelected && count !== null
                            ? count === numbers.length
                              ? "All Numbers"
                              : `+${count} Numbers`
                            : "Manage Access"}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => { setResetId(user.id); setResetPw(""); setResetError(null) }}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Reset Password
                          </button>
                          {!isCurrentUser && (
                            <button
                              onClick={() => removeUser(user.id)}
                              className="text-xs text-red-500 hover:underline"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                      </Fragment>
                    )
                  })
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Number access side panel */}
      {selectedUser && (
        <div className="w-72 shrink-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Number Access</p>
              <p className="text-xs text-gray-500 mt-0.5">{selectedUser.name}</p>
            </div>
            <button
              onClick={() => setSelectedUser(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {numbersLoading ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">Loading…</div>
            ) : numberRows.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">No numbers configured.</div>
            ) : (
              numberRows.map((num) => (
                <label
                  key={num.id}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    num.hasAccess ? "bg-blue-50" : "hover:bg-gray-50"
                  }`}
                >
                  {toggling === num.id ? (
                    <svg className="w-4 h-4 animate-spin text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  ) : (
                    <input
                      type="checkbox"
                      checked={num.hasAccess}
                      onChange={() => toggleNumber(num.id, num.hasAccess)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{num.number}</p>
                    {num.label && <p className="text-xs text-gray-500 truncate">{num.label}</p>}
                  </div>
                  {num.isDefault && (
                    <span className="ml-auto text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded shrink-0">
                      Default
                    </span>
                  )}
                </label>
              ))
            )}
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {resetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 shadow-xl w-80">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Reset Password</h3>
            <input
              type="password"
              placeholder="New password (min 8 chars)"
              value={resetPw}
              onChange={(e) => setResetPw(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {resetError && <p className="text-xs text-red-600 mb-2">{resetError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setResetId(null)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded"
              >
                Cancel
              </button>
              <button
                onClick={resetPassword}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
