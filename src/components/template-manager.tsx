"use client"

import { useEffect, useRef, useState } from "react"
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

// Parameters the fax engine fills in when rendering an uploaded TRDX cover
// sheet. Bind a TextBox in your report with =Parameters.<name>.Value.
const TRDX_FIELDS: { name: string; desc: string; example: string }[] = [
  { name: "recipientName", desc: "Recipient's name", example: "Dr. Jane Smith" },
  { name: "toNumber", desc: "Recipient's fax number", example: "+17185550199" },
  { name: "fromName", desc: "Sender name (from template or number)", example: "Prime Infusions" },
  { name: "fromNumber", desc: "Sending fax number", example: "+17185003640" },
  { name: "subject", desc: "Fax subject line", example: "Prior Authorization" },
  { name: "message", desc: "Cover sheet message / body", example: "This fax contains…" },
  { name: "contactInfo", desc: "Sender contact details (multi-line)", example: "123 Main St…" },
  { name: "date", desc: "Date the fax is sent", example: "June 19, 2026" },
]

export default function TemplateManager() {
  const [templates, setTemplates] = useState<CoverSheetTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<CoverSheetTemplate | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // File upload state (only usable after template is saved/exists)
  const [savedTemplate, setSavedTemplate] = useState<CoverSheetTemplate | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const [showGuide, setShowGuide] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    const res = await fetch("/api/templates")
    if (res.ok) setTemplates(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(null)
    setSavedTemplate(null)
    setUploadFile(null)
    setUploadError("")
    setForm(emptyForm)
    setError("")
    setShowForm(true)
  }

  function openEdit(t: CoverSheetTemplate) {
    setEditing(t)
    setSavedTemplate(t)
    setUploadFile(null)
    setUploadError("")
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

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? "Failed to save")
      setSaving(false)
      return
    }

    let saved: CoverSheetTemplate = await res.json()
    // If a design file was staged (e.g. while creating a new template), upload
    // it now that we have a template id.
    if (uploadFile) {
      const updated = await uploadFileTo(saved.id)
      if (updated) saved = updated
    }
    setSavedTemplate(saved)
    if (!editing) setEditing(saved)
    await load()
    setSaving(false)
  }

  // Uploads the currently-staged file to a template; returns the updated record.
  async function uploadFileTo(templateId: string): Promise<CoverSheetTemplate | null> {
    if (!uploadFile) return null
    setUploading(true)
    setUploadError("")

    const fd = new FormData()
    fd.append("file", uploadFile)
    fd.append("templateId", templateId)

    const res = await fetch("/api/templates/upload", { method: "POST", body: fd })
    setUploading(false)
    if (res.ok) {
      const updated: CoverSheetTemplate = await res.json()
      setUploadFile(null)
      return updated
    }
    const data = await res.json().catch(() => ({}))
    setUploadError(data.error ?? "Upload failed")
    return null
  }

  async function uploadDesignFile() {
    if (!uploadFile || !savedTemplate) return
    const updated = await uploadFileTo(savedTemplate.id)
    if (updated) {
      setSavedTemplate(updated)
      await load()
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this template?")) return
    await fetch(`/api/templates/${id}`, { method: "DELETE" })
    if (editing?.id === id) setShowForm(false)
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

  const currentFile = savedTemplate?.fileName ?? editing?.fileName

  return (
    <div className="flex gap-6">
      {/* List */}
      <div className="flex-1">
        {/* TRDX guide */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
          <button
            onClick={() => setShowGuide((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left"
          >
            <span className="text-sm font-semibold text-gray-900">
              Building a custom TRDX cover sheet
              <span className="ml-2 text-xs font-normal text-gray-400">available fields &amp; sample file</span>
            </span>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${showGuide ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showGuide && (
            <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                Design your cover sheet in any tool that exports Telerik Reporting
                {" "}<strong>.trdx</strong> (e.g. Telerik Report Designer), then upload it to a template
                below. Add a <strong>Report Parameter</strong> (type String) for each field you want filled
                in, and bind a TextBox to it with{" "}
                <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">=Parameters.recipientName.Value</code>.
                When a fax is sent using the template, these parameters are filled in and the report is
                rendered to PDF as the cover page.
              </p>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left">
                      <th className="px-4 py-2">Parameter name</th>
                      <th className="px-4 py-2">Description</th>
                      <th className="px-4 py-2">Example</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {TRDX_FIELDS.map((f) => (
                      <tr key={f.name}>
                        <td className="px-4 py-2"><code className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-xs font-mono">{f.name}</code></td>
                        <td className="px-4 py-2 text-gray-600">{f.desc}</td>
                        <td className="px-4 py-2 text-gray-400 text-xs">{f.example}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="/sample-cover-sheet.trdx"
                  download
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download sample .trdx
                </a>
                <span className="text-xs text-gray-500">Open it in Telerik Report Designer as a starting point, then customize the layout.</span>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed">
                <strong>Notes:</strong> Supported report items are TextBox, HtmlTextBox, Line, PictureBox, and
                colored boxes — typical cover-sheet layout. Unsupported features are skipped, and if a TRDX
                can&apos;t be rendered the system falls back to a generated cover sheet. You can also upload a
                plain <strong>.pdf</strong> to use it directly as the cover page.
              </p>
            </div>
          )}
        </div>

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
                  <th className="px-5 py-3">Design File</th>
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
                      {t.fileName ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          {t.fileName}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
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

            {/* Design file (TRDX / PDF / XML) — available when creating or editing */}
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Design File</p>
                {currentFile && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    {currentFile}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Optionally upload a <strong>.trdx</strong>, <strong>.pdf</strong>, or <strong>.xml</strong> cover sheet
                design. Leave blank to generate the cover sheet from the text fields above.
              </p>

              <div
                className={`border-2 border-dashed rounded-lg px-4 py-5 text-center cursor-pointer transition-colors ${
                  uploadFile ? "border-purple-400 bg-purple-50" : "border-gray-200 hover:border-gray-300 bg-gray-50"
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const f = e.dataTransfer.files[0]
                  if (f) setUploadFile(f)
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".trdx,.pdf,.xml,application/xml,text/xml,application/pdf"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) setUploadFile(f) }}
                />
                {uploadFile ? (
                  <div>
                    <p className="text-xs font-medium text-purple-700">{uploadFile.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{(uploadFile.size / 1024).toFixed(0)} KB · Click to change</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">
                    Drop .trdx / .pdf / .xml here or <span className="text-blue-600 font-medium">browse</span>
                  </p>
                )}
              </div>

              {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}

              {uploadFile && !savedTemplate && (
                <p className="text-xs text-gray-500">This file will be uploaded when you create the template.</p>
              )}
              {uploadFile && savedTemplate && (
                <button
                  onClick={uploadDesignFile}
                  disabled={uploading}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {uploading ? "Uploading…" : currentFile ? "Replace File" : "Upload File"}
                </button>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={save} disabled={saving} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                {saving ? (uploading ? "Uploading…" : "Saving…") : editing ? "Save Changes" : "Create Template"}
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
