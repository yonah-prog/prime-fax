"use client"

import { useState } from "react"
import type { User } from "@/lib/db/schema"

type SafeUser = Omit<User, "passwordHash">

interface Props {
  initial: SafeUser[]
  currentUserId: string
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
      role === "admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"
    }`}>{role}</span>
  )
}

export default function UserManager({ initial, currentUserId }: Props) {
  const [users, setUsers] = useState<SafeUser[]>(initial)
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "staff" })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [resetId, setResetId] = useState<string | null>(null)
  const [resetPw, setResetPw] = useState("")
  const [resetError, setResetError] = useState<string | null>(null)

  async function addUser() {
    if (!form.name || !form.email || !form.password) { setError("All fields are required."); return }
    setSaving(true); setError(null)
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
    setForm({ name: "", email: "", password: "", role: "staff" })
  }

  async function changeRole(id: string, role: string) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    })
    setUsers(users.map((u) => u.id === id ? { ...u, role: role as "admin" | "staff" } : u))
  }

  async function resetPassword() {
    if (!resetPw || resetPw.length < 8) { setResetError("Password must be at least 8 characters."); return }
    const res = await fetch(`/api/admin/users/${resetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: resetPw }),
    })
    if (!res.ok) { setResetError("Failed to reset password."); return }
    setResetId(null); setResetPw(""); setResetError(null)
  }

  async function removeUser(id: string) {
    if (id === currentUserId) return
    if (!confirm("Remove this user? They will no longer be able to log in.")) return
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" })
    setUsers(users.filter((u) => u.id !== id))
  }

  return (
    <div>
      {/* Add user form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Add New User</h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <input type="text" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="password" placeholder="Password (min 8 chars)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <button onClick={addUser} disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60">
          {saving ? "Creating…" : "Create User"}
        </button>
      </div>

      {/* User list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              <th className="px-5 pb-3 pt-4">Name</th>
              <th className="px-5 pb-3 pt-4">Email</th>
              <th className="px-5 pb-3 pt-4">Role</th>
              <th className="px-5 pb-3 pt-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-medium text-gray-900">
                  {user.name}
                  {user.id === currentUserId && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                </td>
                <td className="px-5 py-3 text-gray-500">{user.email}</td>
                <td className="px-5 py-3">
                  {user.id === currentUserId ? (
                    <RoleBadge role={user.role} />
                  ) : (
                    <select value={user.role} onChange={(e) => changeRole(user.id, e.target.value)}
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none">
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => { setResetId(user.id); setResetPw(""); setResetError(null) }}
                      className="text-xs text-blue-600 hover:underline">Reset Password</button>
                    {user.id !== currentUserId && (
                      <button onClick={() => removeUser(user.id)} className="text-xs text-red-500 hover:underline">Remove</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reset password modal */}
      {resetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 shadow-xl w-80">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Reset Password</h3>
            <input type="password" placeholder="New password (min 8 chars)" value={resetPw} onChange={(e) => setResetPw(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {resetError && <p className="text-xs text-red-600 mb-2">{resetError}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setResetId(null)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded">Cancel</button>
              <button onClick={resetPassword} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
