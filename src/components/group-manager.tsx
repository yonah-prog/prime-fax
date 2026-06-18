"use client"

import { useState } from "react"

interface GroupRow {
  id: string
  name: string
  description: string | null
  memberCount: number
  createdAt: Date
  updatedAt: Date
}

interface MemberRow {
  id: string
  name: string
  email: string
  role: string
  inGroup: boolean
}

export default function GroupManager({ initial }: { initial: GroupRow[] }) {
  const [groups, setGroups] = useState<GroupRow[]>(initial)
  const [form, setForm] = useState({ name: "", description: "" })
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [selectedGroup, setSelectedGroup] = useState<GroupRow | null>(null)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editDesc, setEditDesc] = useState("")
  const [editError, setEditError] = useState<string | null>(null)

  async function loadMembers(group: GroupRow) {
    if (selectedGroup?.id === group.id) { setSelectedGroup(null); return }
    setSelectedGroup(group)
    setMembersLoading(true)
    const res = await fetch(`/api/admin/groups/${group.id}/users`)
    if (res.ok) setMembers(await res.json())
    setMembersLoading(false)
  }

  async function toggleMember(userId: string, currentInGroup: boolean) {
    setToggling(userId)
    const inGroup = !currentInGroup
    await fetch(`/api/admin/groups/${selectedGroup!.id}/users`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, inGroup }),
    })
    setMembers((rows) => rows.map((r) => r.id === userId ? { ...r, inGroup } : r))
    const delta = inGroup ? 1 : -1
    setGroups((gs) => gs.map((g) => g.id === selectedGroup!.id ? { ...g, memberCount: g.memberCount + delta } : g))
    setSelectedGroup((g) => g ? { ...g, memberCount: g.memberCount + delta } : g)
    setToggling(null)
  }

  async function createGroup() {
    if (!form.name.trim()) { setFormError("Name is required."); return }
    setSaving(true); setFormError(null)
    const res = await fetch("/api/admin/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.status === 409) { setFormError("A group with that name already exists."); return }
    if (!res.ok) { setFormError("Failed to create group."); return }
    const group: GroupRow = await res.json()
    setGroups([...groups, group])
    setForm({ name: "", description: "" })
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) { setEditError("Name is required."); return }
    const res = await fetch(`/api/admin/groups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, description: editDesc }),
    })
    if (res.status === 409) { setEditError("A group with that name already exists."); return }
    if (!res.ok) { setEditError("Failed to save."); return }
    const updated: GroupRow = await res.json()
    setGroups((gs) => gs.map((g) => g.id === id ? { ...g, name: updated.name, description: updated.description } : g))
    if (selectedGroup?.id === id) setSelectedGroup((g) => g ? { ...g, name: updated.name, description: updated.description } : g)
    setEditingId(null)
  }

  async function deleteGroup(id: string) {
    if (!confirm("Delete this group? Members will not be removed, only the group itself.")) return
    await fetch(`/api/admin/groups/${id}`, { method: "DELETE" })
    setGroups((gs) => gs.filter((g) => g.id !== id))
    if (selectedGroup?.id === id) setSelectedGroup(null)
  }

  return (
    <div className="flex gap-6 items-start">
      <div className="flex-1 min-w-0">
        {/* Create group form */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Create New Group</h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              type="text" placeholder="Group name" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text" placeholder="Description (optional)" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {formError && <p className="text-xs text-red-600 mb-2">{formError}</p>}
          <button onClick={createGroup} disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60">
            {saving ? "Creating…" : "Create Group"}
          </button>
        </div>

        {/* Group list */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {groups.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">No groups yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-5 pb-3 pt-4">Name</th>
                  <th className="px-5 pb-3 pt-4">Description</th>
                  <th className="px-5 pb-3 pt-4">Members</th>
                  <th className="px-5 pb-3 pt-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {groups.map((group) => (
                  <tr
                    key={group.id}
                    onClick={() => { if (editingId !== group.id) loadMembers(group) }}
                    className={`cursor-pointer transition-colors ${selectedGroup?.id === group.id ? "bg-blue-50" : "hover:bg-gray-50"}`}
                  >
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {editingId === group.id ? (
                        <input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="border border-blue-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : group.name}
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {editingId === group.id ? (
                        <input
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Description"
                          className="border border-gray-200 rounded px-2 py-1 text-sm w-full focus:outline-none"
                        />
                      ) : (group.description ?? <span className="text-gray-300">—</span>)}
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{group.memberCount}</span>
                    </td>
                    <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {editingId === group.id ? (
                        <div className="flex items-center justify-end gap-2">
                          {editError && <span className="text-xs text-red-500">{editError}</span>}
                          <button onClick={() => saveEdit(group.id)} className="text-xs text-blue-600 hover:underline">Save</button>
                          <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 hover:underline">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => { setEditingId(group.id); setEditName(group.name); setEditDesc(group.description ?? ""); setEditError(null) }}
                            className="text-xs text-blue-600 hover:underline">Rename</button>
                          <button onClick={() => deleteGroup(group.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">Click a group row to manage its members.</p>
      </div>

      {/* Member assignment panel */}
      {selectedGroup && (
        <div className="w-72 shrink-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Members</p>
              <p className="text-xs text-gray-500 mt-0.5">{selectedGroup.name}</p>
            </div>
            <button onClick={() => setSelectedGroup(null)} className="text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {membersLoading ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">Loading…</div>
            ) : members.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">No users found.</div>
            ) : members.map((user) => (
              <label
                key={user.id}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${user.inGroup ? "bg-blue-50" : "hover:bg-gray-50"}`}
              >
                {toggling === user.id ? (
                  <svg className="w-4 h-4 animate-spin text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                ) : (
                  <input
                    type="checkbox"
                    checked={user.inGroup}
                    onChange={() => toggleMember(user.id, user.inGroup)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${user.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
                  {user.role}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
