"use client"

import { useCallback, useEffect, useState } from "react"
import { useDropzone } from "react-dropzone"
import { useRouter, useSearchParams } from "next/navigation"
import { showToast } from "./toast"
import type { CoverSheetTemplate, Contact, PhoneNumber } from "@/lib/db/schema"

const DEFAULT_COVER_MESSAGE =
  "This fax contains confidential information intended only for the designated recipient(s). If you received this fax in error, please notify the sender immediately and destroy all copies. Do not disclose, copy, or distribute without authorization. (45 CFR 164.530)"

type SubmitStatus = "idle" | "sending" | "success" | "error"

function ToolbarButton({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick?: () => void; active?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${active ? "text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
    >
      {icon}
      {label}
    </button>
  )
}

const defaultForm = {
  fromNumberId: "",
  fromName: "",
  subject: "",
  hasCoverSheet: true,
  coverSheetMessage: DEFAULT_COVER_MESSAGE,
  contactInfo: "",
  pageSize: "letter",
  resolution: "fine",
  scheduledAt: "",
}

export default function SendForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Recipients: array for broadcast support
  const [recipients, setRecipients] = useState<Array<{ name: string; number: string }>>([{ name: "", number: "" }])
  const [form, setForm] = useState(defaultForm)
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<SubmitStatus>("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [templates, setTemplates] = useState<CoverSheetTemplate[]>([])
  const [numbers, setNumbers] = useState<PhoneNumber[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactSearch, setContactSearch] = useState("")
  const [showContacts, setShowContacts] = useState(false)
  const [activeRecipientIdx, setActiveRecipientIdx] = useState(0)

  useEffect(() => {
    fetch("/api/templates").then((r) => r.json()).then((data) => { if (Array.isArray(data)) setTemplates(data) }).catch(() => {})
    fetch("/api/numbers").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) {
        setNumbers(data)
        const def = data.find((n: PhoneNumber) => n.isDefault) ?? data[0]
        if (def) setForm((f) => ({ ...f, fromNumberId: def.id }))
      }
    }).catch(() => {})
    fetch("/api/contacts").then((r) => r.json()).then((data) => { if (Array.isArray(data)) setContacts(data) }).catch(() => {})
  }, [])

  // Prefill from ?resend=<faxId> query param
  useEffect(() => {
    const resendId = searchParams.get("resend")
    if (!resendId) return
    fetch(`/api/faxes/${resendId}`).then((r) => r.json()).then((fax) => {
      if (!fax?.id) return
      setRecipients([{ name: fax.recipientName ?? "", number: fax.toNumber }])
      setForm((f) => ({
        ...f,
        fromName: fax.fromName ?? f.fromName,
        subject: fax.subject ?? f.subject,
        hasCoverSheet: fax.hasCoverSheet ?? f.hasCoverSheet,
        coverSheetMessage: fax.coverSheetMessage ?? f.coverSheetMessage,
        contactInfo: fax.contactInfo ?? f.contactInfo,
        pageSize: fax.pageSize ?? f.pageSize,
        resolution: fax.resolution ?? f.resolution,
      }))
    }).catch(() => {})
  }, [searchParams])

  function pickContact(c: Contact) {
    setRecipients((prev) => {
      const next = [...prev]
      next[activeRecipientIdx] = { name: c.name, number: c.faxNumber }
      return next
    })
    setShowContacts(false)
    setContactSearch("")
  }

  const filteredContacts = contacts.filter((c) =>
    `${c.name} ${c.faxNumber} ${c.company ?? ""}`.toLowerCase().includes(contactSearch.toLowerCase())
  )

  function applyTemplate(id: string) {
    const t = templates.find((t) => t.id === id)
    if (!t) return
    setForm((f) => ({
      ...f,
      fromName: t.fromName ?? f.fromName,
      coverSheetMessage: t.coverSheetMessage ?? f.coverSheetMessage,
      contactInfo: t.contactInfo ?? f.contactInfo,
    }))
  }

  const onDrop = useCallback((accepted: File[]) => { if (accepted[0]) setFile(accepted[0]) }, [])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"], "image/tiff": [".tif", ".tiff"], "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"] },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
  })

  function resetForm() {
    setFile(null)
    setForm(defaultForm)
    setRecipients([{ name: "", number: "" }])
    setStatus("idle")
    setErrorMsg("")
  }

  const set = (key: keyof typeof defaultForm, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }))

  function addRecipient() { setRecipients((r) => [...r, { name: "", number: "" }]) }
  function removeRecipient(i: number) { setRecipients((r) => r.filter((_, idx) => idx !== i)) }
  function updateRecipient(i: number, field: "name" | "number", value: string) {
    setRecipients((r) => { const n = [...r]; n[i] = { ...n[i], [field]: value }; return n })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validRecipients = recipients.filter((r) => r.number.trim())
    if (validRecipients.length === 0) return

    setStatus("sending")
    setErrorMsg("")

    const selectedNumber = numbers.find((n) => n.id === form.fromNumberId)
    const fromNumber = selectedNumber?.number ?? process.env.NEXT_PUBLIC_FROM_NUMBER ?? ""

    const data = new FormData()
    if (file) data.append("file", file)
    data.append("to", validRecipients.map((r) => r.number).join(","))
    data.append("from", fromNumber)
    data.append("fromName", form.fromName)
    data.append("recipientName", validRecipients[0].name)
    data.append("subject", form.subject)
    data.append("hasCoverSheet", String(form.hasCoverSheet))
    data.append("coverSheetMessage", form.coverSheetMessage)
    data.append("contactInfo", form.contactInfo)
    data.append("pageSize", form.pageSize)
    data.append("resolution", form.resolution)
    if (form.scheduledAt) data.append("scheduledAt", form.scheduledAt)

    const res = await fetch("/api/faxes/send", { method: "POST", body: data })
    const json = await res.json().catch(() => ({}))

    if (res.ok) {
      const isScheduled = json.results?.every((r: { status: string }) => r.status === "scheduled")
      const count = validRecipients.length
      setStatus("success")
      showToast(
        isScheduled
          ? `${count} fax${count > 1 ? "es" : ""} scheduled`
          : `${count} fax${count > 1 ? "es" : ""} sent successfully`,
        "success"
      )
      setTimeout(() => router.push(isScheduled ? "/in-progress" : "/sent"), 1200)
    } else {
      setErrorMsg(json.error ?? "Failed to send fax. Please try again.")
      setStatus("error")
      showToast(json.error ?? "Failed to send fax", "error")
    }
  }

  const isScheduled = !!form.scheduledAt
  const isBroadcast = recipients.length > 1

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Compose New Fax</h1>
        {isBroadcast && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Broadcast × {recipients.length}</span>}
        {isScheduled && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Scheduled</span>}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-gray-200 pb-3 mb-5">
        <ToolbarButton label="Send Fax" active icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>} />
        <ToolbarButton label="Add Recipient" onClick={addRecipient} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" /></svg>} />
        <ToolbarButton label="Contacts" onClick={() => setShowContacts((v) => !v)} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
        <ToolbarButton label="Reset Form" onClick={resetForm} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>} />
      </div>

      {/* Cover Sheet toggle */}
      <div className="flex items-center gap-3 mb-1">
        <span className="text-sm font-medium text-gray-700">Cover Sheet</span>
        <button type="button" onClick={() => set("hasCoverSheet", !form.hasCoverSheet)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.hasCoverSheet ? "bg-blue-500" : "bg-gray-300"}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.hasCoverSheet ? "translate-x-4" : "translate-x-0.5"}`} />
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-6">Attach documents, fill out your cover sheet, and send.</p>

      {/* Template selector */}
      {templates.length > 0 && (
        <div className="mb-5">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Load Template</label>
          <select defaultValue="" onChange={(e) => applyTemplate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="" disabled>Select a template…</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isDefault ? " (default)" : ""}</option>)}
          </select>
        </div>
      )}

      <div className="space-y-5">
        {/* Recipients */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-semibold text-gray-700">
              {isBroadcast ? `Recipients (${recipients.length})` : "Receiver"}
            </label>
            {contacts.length > 0 && (
              <button type="button" onClick={() => setShowContacts((v) => !v)} className="text-xs text-blue-600 hover:underline">
                {showContacts ? "Hide contacts" : "Pick from contacts"}
              </button>
            )}
          </div>

          <div className="space-y-2">
            {recipients.map((r, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="tel"
                  value={r.number}
                  onChange={(e) => updateRecipient(i, "number", e.target.value)}
                  onFocus={() => setActiveRecipientIdx(i)}
                  placeholder="Fax number"
                  required={i === 0}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={r.name}
                  onChange={(e) => updateRecipient(i, "name", e.target.value)}
                  placeholder="Name (optional)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {recipients.length > 1 && (
                  <button type="button" onClick={() => removeRecipient(i)} className="text-gray-400 hover:text-red-500 px-1">✕</button>
                )}
              </div>
            ))}
          </div>

          {showContacts && (
            <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
                <input type="text" value={contactSearch} onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Search…" autoFocus className="w-full text-sm bg-transparent focus:outline-none" />
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
                {filteredContacts.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-gray-400">No matches</p>
                ) : filteredContacts.map((c) => (
                  <button key={c.id} type="button" onClick={() => pickContact(c)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50 text-left transition-colors"
                  >
                    <div>
                      <span className="text-sm font-medium text-gray-900">{c.name}</span>
                      {c.company && <span className="text-xs text-gray-400 ml-2">{c.company}</span>}
                    </div>
                    <span className="font-mono text-xs text-gray-500">{c.faxNumber}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* From Name + From Number */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">From Name</label>
            <input type="text" value={form.fromName} onChange={(e) => set("fromName", e.target.value)}
              placeholder="Your name or practice"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">From Number</label>
            <select value={form.fromNumberId} onChange={(e) => set("fromNumberId", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {numbers.length === 0 && <option value="">No numbers configured</option>}
              {numbers.map((n) => <option key={n.id} value={n.id}>{n.label ? `${n.label} — ` : ""}{n.number}</option>)}
            </select>
          </div>
        </div>

        {/* Page Size + Resolution */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Page Size</label>
            <select value={form.pageSize} onChange={(e) => set("pageSize", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="letter">Letter</option>
              <option value="legal">Legal</option>
              <option value="a4">A4</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Resolution</label>
            <select value={form.resolution} onChange={(e) => set("resolution", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="fine">Fine (Best quality)</option>
              <option value="standard">Standard</option>
            </select>
          </div>
        </div>

        {/* Schedule */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Schedule Send <span className="text-gray-400 font-normal">(leave blank to send now)</span>
          </label>
          <input type="datetime-local" value={form.scheduledAt} onChange={(e) => set("scheduledAt", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {/* Upload */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Upload Attachments <span className="text-gray-400 font-normal">Maximum 50mb file size</span>
          </label>
          <div {...getRootProps()}
            className={`border-2 border-dashed rounded px-6 py-8 text-center cursor-pointer transition-colors ${
              isDragActive ? "border-blue-400 bg-blue-50" : file ? "border-green-400 bg-green-50" : "border-gray-300 hover:border-gray-400 bg-white"
            }`}
          >
            <input {...getInputProps()} />
            {file ? (
              <div>
                <p className="text-sm font-medium text-green-700">{file.name}</p>
                <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(0)} KB · Click to replace</p>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-gray-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <span className="text-sm">{isDragActive ? "Drop it here" : <>Drop files here or <strong className="text-gray-700">browse</strong></>}</span>
              </div>
            )}
          </div>
        </div>

        {/* Cover sheet fields */}
        {form.hasCoverSheet && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Receiver Name</label>
                <input type="text" value={recipients[0]?.name ?? ""} onChange={(e) => updateRecipient(0, "name", e.target.value)}
                  placeholder="Receiver Name"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Subject</label>
                <input type="text" value={form.subject} onChange={(e) => set("subject", e.target.value)}
                  placeholder="Subject"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Cover Sheet Message</label>
              <textarea value={form.coverSheetMessage} onChange={(e) => set("coverSheetMessage", e.target.value)}
                rows={4} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Your Contact Info <span className="text-gray-400 font-normal">Phone number, company, address, email, etc.</span>
              </label>
              <textarea value={form.contactInfo} onChange={(e) => set("contactInfo", e.target.value)}
                rows={4} placeholder="Contact Information"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y" />
            </div>
          </>
        )}

        {status === "error" && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={recipients.every((r) => !r.number.trim()) || status === "sending" || status === "success"}
          className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold rounded transition-colors flex items-center justify-center gap-2"
        >
          {status === "sending" ? "Sending…" : (
            <>
              {isScheduled ? "Schedule Fax" : isBroadcast ? `Send to ${recipients.filter(r => r.number).length} Recipients` : "Send Fax"}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>
    </form>
  )
}
