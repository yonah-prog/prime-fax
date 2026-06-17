"use client"

import { useEffect, useState } from "react"
import type { CoverSheetTemplate } from "@/lib/db/schema"

const DEFAULT_MESSAGE =
  "This fax contains confidential information intended only for the designated recipient(s). If you received this fax in error, please notify the sender immediately and destroy all copies. Do not disclose, copy, or distribute without authorization. (45 CFR 164.530)"

const emptyForm = {
  name: "",
  fromName: "",
  coverSheetMessage: DEFAULT_MESSAGE,
  contactInfo: "",
  isDefault: false,
}

type FormState = typeof emptyForm

export default function TemplateManager() {
  const [templates, setTemplates] = useState<CoverSheetTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<CoverSheetTemplate | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function load() {
    setLoading(true)
    const res = await fetch("/api/templates")
    if (res.ok) setTemplates(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(null)
    setForm(emptyForm)
    setError("")
    setShowForm(true)
  }

  function openEdit(t: CoverSheetTemplate) {
    setEditing(t)
    setForm({
      name: t.name,
      fromName: t.fromName ?? "",
      coverSheetMessage: t.coverSheetMessage ?? "",
      contactInfo: t.contactInfo ?? "",
      isDefault: t.isDefault,
    })
    setError("")
    setShowForm(true)
  }

  async function save() {
    if (!form.name.trim()) { setError("Name is required"); return }
    setSaving(true)
    setError("")

    const url = editing ? `/api/templates/${editing.id}` : "/api/templates"
    const method = editing ? "PUT" : "POST"
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })

    if (res.ok) {
      setShowForm(false)
      await load()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? "Failed to save")
    }
    setSaving(false)
  }

  async function remove(id: string) {
    if (!confirm("Delete this template?")) return
    await fetch(`/api/templates/${id}`, { method: "DELETE" })
    await load()
  }

  function field(key: keyof FormState, label: string, type: "text" | "textarea" = "text", placeholder = "") {
    const value = form[key] as string
    const cls = "w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        {type === "textarea" ? (
          <textarea rows={4} value={value} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} className={`${cls} resize-y`} />
        ) : (
          <input type="text" value={value} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} className={cls} />
        )}
      </div>
    )
  }

  return (
    <div className="flex gap-6">
      {/* List */}
      <div className="flex-1">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">{templates.length} template{templates.length !== 1 ? "s" : ""}</span>
            <button onClick={openNew} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
              + New Template
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
          ) : templates.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">No templates yet. Create one to pre-fill compose fields.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide text-left">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">From Name</th>
                  <th className="px-5 py-3">Default</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {templates.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{t.name}</td>
                    <td className="px-5 py-3 text-gray-600">{t.fromName || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3">
                      {t.isDefault && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">Default</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3 justify-end">
                        <button onClick={() => openEdit(t)} className="text-sm text-blue-600 hover:underline">Edit</button>
                        <button onClick={() => remove(t.id)} className="text-sm text-red-500 hover:underline">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Form panel */}
      {showForm && (
        <div className="w-96 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 sticky top-0">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">{editing ? "Edit Template" : "New Template"}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

            {field("name", "Template Name *", "text", "e.g. HIPAA Standard")}
            {field("fromName", "Default From Name", "text", "Your practice or name")}
            {field("coverSheetMessage", "Cover Sheet Message", "textarea")}
            {field("contactInfo", "Contact Info", "textarea", "Phone, address, email…")}

            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Set as default template
            </label>

            <div className="flex gap-3 pt-2">
              <button onClick={save} disabled={saving} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                {saving ? "Saving…" : editing ? "Save Changes" : "Create Template"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
