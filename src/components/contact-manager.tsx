"use client"

import { useEffect, useState } from "react"
import type { Contact } from "@/lib/db/schema"

const emptyForm = { name: "", faxNumber: "", company: "", notes: "" }

export default function ContactManager({ onPick }: { onPick?: (c: Contact) => void }) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<Contact | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function load() {
    setLoading(true)
    const res = await fetch("/api/contacts")
    if (res.ok) setContacts(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() { setEditing(null); setForm(emptyForm); setError(""); setShowForm(true) }
  function openEdit(c: Contact) {
    setEditing(c)
    setForm({ name: c.name, faxNumber: c.faxNumber, company: c.company ?? "", notes: c.notes ?? "" })
    setError("")
    setShowForm(true)
  }

  async function save() {
    if (!form.name.trim() || !form.faxNumber.trim()) { setError("Name and fax number are required"); return }
    setSaving(true); setError("")
    const url = editing ? `/api/contacts/${editing.id}` : "/api/contacts"
    const method = editing ? "PUT" : "POST"
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
    if (res.ok) { setShowForm(false); await load() }
    else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed to save") }
    setSaving(false)
  }

  async function remove(id: string) {
    if (!confirm("Delete this contact?")) return
    await fetch(`/api/contacts/${id}`, { method: "DELETE" })
    await load()
  }

  const filtered = contacts.filter((c) =>
    `${c.name} ${c.faxNumber} ${c.company ?? ""}`.toLowerCase().includes(search.toLowerCase())
  )

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="flex gap-6">
      <div className="flex-1">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts…"
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={openNew} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap">
              + New Contact
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              {contacts.length === 0 ? "No contacts yet." : "No matches."}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide text-left">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Fax Number</th>
                  <th className="px-5 py-3">Company</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-5 py-3 font-mono text-gray-600 text-xs">{c.faxNumber}</td>
                    <td className="px-5 py-3 text-gray-500">{c.company || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3 justify-end">
                        {onPick && (
                          <button onClick={() => onPick(c)} className="text-sm text-blue-600 hover:underline font-medium">Use</button>
                        )}
                        <button onClick={() => openEdit(c)} className="text-sm text-gray-500 hover:underline">Edit</button>
                        <button onClick={() => remove(c.id)} className="text-sm text-red-500 hover:underline">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showForm && (
        <div className="w-80 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 sticky top-0">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">{editing ? "Edit Contact" : "New Contact"}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
            {(["name", "faxNumber", "company", "notes"] as const).map((key) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                  {key === "faxNumber" ? "Fax Number" : key}{key === "name" || key === "faxNumber" ? " *" : ""}
                </label>
                <input
                  type={key === "faxNumber" ? "tel" : "text"}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={key === "faxNumber" ? "+12125551234" : ""}
                  className={inputCls}
                />
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button onClick={save} disabled={saving} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                {saving ? "Saving…" : editing ? "Save" : "Create"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
