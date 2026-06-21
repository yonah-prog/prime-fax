"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useDropzone } from "react-dropzone"
import { useRouter, useSearchParams } from "next/navigation"
import { showToast } from "./toast"
import type { CoverSheetTemplate, Contact, PhoneNumber } from "@/lib/db/schema"

const AREA_CODE_REGIONS: Record<string, string> = {
  "212": "New York, NY", "718": "New York, NY", "646": "New York, NY", "917": "New York, NY",
  "713": "Houston, TX", "832": "Houston, TX", "281": "Houston, TX",
  "305": "Miami, FL", "786": "Miami, FL", "954": "Fort Lauderdale, FL",
  "561": "West Palm Beach, FL", "407": "Orlando, FL", "813": "Tampa, FL",
  "312": "Chicago, IL", "773": "Chicago, IL", "630": "Chicago suburbs, IL",
  "310": "Los Angeles, CA", "213": "Los Angeles, CA", "323": "Los Angeles, CA",
  "415": "San Francisco, CA", "628": "San Francisco, CA",
  "214": "Dallas, TX", "972": "Dallas, TX", "469": "Dallas, TX",
  "404": "Atlanta, GA", "770": "Atlanta, GA", "678": "Atlanta, GA",
  "602": "Phoenix, AZ", "480": "Phoenix, AZ", "623": "Phoenix, AZ",
  "617": "Boston, MA", "781": "Boston suburbs, MA",
  "215": "Philadelphia, PA", "267": "Philadelphia, PA",
  "702": "Las Vegas, NV", "725": "Las Vegas, NV",
  "503": "Portland, OR", "971": "Portland, OR",
  "206": "Seattle, WA", "425": "Seattle suburbs, WA",
  "303": "Denver, CO", "720": "Denver, CO",
  "314": "St. Louis, MO", "816": "Kansas City, MO",
  "615": "Nashville, TN", "901": "Memphis, TN",
  "504": "New Orleans, LA", "225": "Baton Rouge, LA",
  "702": "Las Vegas, NV", "808": "Hawaii",
  "907": "Alaska",
}

function getAreaCodeRegion(number: string): string {
  const digits = number.replace(/\D/g, "")
  const areaCode = digits.startsWith("1") ? digits.slice(1, 4) : digits.slice(0, 3)
  return AREA_CODE_REGIONS[areaCode] ?? ""
}

function formatNumberLabel(n: { label?: string | null; number: string }): string {
  const region = getAreaCodeRegion(n.number)
  const parts = [n.label, n.number, region ? `(${region})` : ""].filter(Boolean)
  return parts.join(" — ")
}

const DEFAULT_COVER_MESSAGE =
  "This fax contains confidential information intended only for the designated recipient(s). If you received this fax in error, please notify the sender immediately and destroy all copies. Do not disclose, copy, or distribute without authorization. (45 CFR 164.530)"

type SubmitStatus = "idle" | "sending" | "success" | "error"
type SendTab = "send" | "contacts" | "advanced" | "preview" | "import"

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
  coverSheetTemplateId: "",
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
  const [activeRecipientIdx, setActiveRecipientIdx] = useState(0)
  const [activeTab, setActiveTab] = useState<SendTab>("send")
  const [csvPreview, setCsvPreview] = useState<{ number: string; name: string }[]>([])
  const [csvPasteText, setCsvPasteText] = useState("")
  const csvFileInputRef = useRef<HTMLInputElement>(null)

  // Live PDF preview (actual rendered cover sheet + attached PDF)
  const [previewUrl, setPreviewUrl] = useState<string>("")
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState("")

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
    setContactSearch("")
    setActiveTab("send")
  }

  const filteredContacts = contacts.filter((c) =>
    `${c.name} ${c.faxNumber} ${c.company ?? ""}`.toLowerCase().includes(contactSearch.toLowerCase())
  )

  function applyTemplate(id: string) {
    const t = templates.find((t) => t.id === id)
    if (!t) return
    setForm((f) => ({
      ...f,
      coverSheetTemplateId: id,
      fromName: t.fromName ?? f.fromName,
      coverSheetMessage: t.coverSheetMessage ?? f.coverSheetMessage,
      contactInfo: t.contactInfo ?? f.contactInfo,
    }))
  }

  // When the From Number changes, auto-select the cover sheet template
  // associated with that number (if any and it still exists).
  useEffect(() => {
    if (!form.fromNumberId || templates.length === 0) return
    const num = numbers.find((n) => n.id === form.fromNumberId)
    const tplId = num?.coverSheetTemplateId
    if (tplId && tplId !== form.coverSheetTemplateId && templates.some((t) => t.id === tplId)) {
      applyTemplate(tplId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.fromNumberId, templates, numbers])

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
    setCsvPreview([])
    setCsvPasteText("")
  }

  const set = (key: keyof typeof defaultForm, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }))

  function addRecipient() { setRecipients((r) => [...r, { name: "", number: "" }]) }
  function removeRecipient(i: number) { setRecipients((r) => r.filter((_, idx) => idx !== i)) }
  function updateRecipient(i: number, field: "name" | "number", value: string) {
    setRecipients((r) => { const n = [...r]; n[i] = { ...n[i], [field]: value }; return n })
  }

  // CSV parsing helper
  function parseCsvText(text: string): { number: string; name: string }[] {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const cols = line.split(",")
        return { number: (cols[0] ?? "").trim(), name: (cols[1] ?? "").trim() }
      })
      .filter((row) => row.number.length > 0)
  }

  function handleCsvFile(f: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setCsvPreview(parseCsvText(text))
      setCsvPasteText(text)
    }
    reader.readAsText(f)
  }

  function handleCsvPaste(text: string) {
    setCsvPasteText(text)
    setCsvPreview(parseCsvText(text))
  }

  function applyCsvImport() {
    if (csvPreview.length === 0) return
    setRecipients(csvPreview)
    setCsvPreview([])
    setCsvPasteText("")
    setActiveTab("send")
    showToast(`${csvPreview.length} recipient${csvPreview.length > 1 ? "s" : ""} imported`, "success")
  }

  const generatePreview = useCallback(async () => {
    setPreviewLoading(true)
    setPreviewError("")
    try {
      const validRecipients = recipients.filter((r) => r.number.trim())
      const selectedNumber = numbers.find((n) => n.id === form.fromNumberId)
      const fromNumber = selectedNumber?.number ?? ""

      const data = new FormData()
      if (file) data.append("file", file)
      data.append("to", validRecipients[0]?.number ?? "")
      data.append("from", fromNumber)
      data.append("fromName", form.fromName)
      data.append("recipientName", validRecipients[0]?.name ?? "")
      data.append("subject", form.subject)
      data.append("hasCoverSheet", String(form.hasCoverSheet))
      if (form.coverSheetTemplateId) data.append("coverSheetTemplateId", form.coverSheetTemplateId)
      data.append("coverSheetMessage", form.coverSheetMessage)
      data.append("contactInfo", form.contactInfo)

      const res = await fetch("/api/faxes/preview", { method: "POST", body: data })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? "Could not generate preview")
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url })
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Could not generate preview")
    } finally {
      setPreviewLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipients, numbers, form, file])

  // Regenerate the PDF preview whenever the Preview tab is opened.
  useEffect(() => {
    if (activeTab !== "preview") return
    generatePreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Clean up the blob URL on unmount.
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

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
    if (form.coverSheetTemplateId) data.append("coverSheetTemplateId", form.coverSheetTemplateId)
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

  const tabs: { id: SendTab; label: string }[] = [
    { id: "send", label: "Send Fax" },
    { id: "contacts", label: "Contacts" },
    { id: "advanced", label: "Advanced" },
    { id: "preview", label: "Preview" },
    { id: "import", label: "Import List" },
  ]

  return (
    <form onSubmit={handleSubmit}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Compose New Fax</h1>
        {isBroadcast && (
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
            Broadcast × {recipients.length}
          </span>
        )}
        {isScheduled && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
            Scheduled
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-end gap-0 border-b border-gray-200 mb-5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="ml-auto flex items-center pb-1">
          <button
            type="button"
            onClick={resetForm}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-2"
            title="Reset form"
          >
            Reset
          </button>
        </div>
      </div>

      {/* ── SEND FAX TAB ── */}
      {activeTab === "send" && (
        <div className="space-y-5">
          {/* Recipients */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-gray-700">
                {isBroadcast ? `Recipients (${recipients.length})` : "Receiver"}
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={addRecipient}
                  className="text-xs text-blue-600 hover:underline"
                >
                  + Add recipient
                </button>
                {contacts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("contacts")}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Pick from contacts
                  </button>
                )}
              </div>
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
                    <button
                      type="button"
                      onClick={() => removeRecipient(i)}
                      className="text-gray-400 hover:text-red-500 px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* From Name + From Number */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">From Name</label>
              <input
                type="text"
                value={form.fromName}
                onChange={(e) => set("fromName", e.target.value)}
                placeholder="Your name or practice"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">From Number</label>
              <select
                value={form.fromNumberId}
                onChange={(e) => set("fromNumberId", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {numbers.length === 0 && <option value="">No numbers configured</option>}
                {numbers.map((n) => (
                  <option key={n.id} value={n.id}>
                    {formatNumberLabel(n)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cover Sheet toggle + template picker */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-700">Cover Sheet</span>
              <button
                type="button"
                onClick={() => set("hasCoverSheet", !form.hasCoverSheet)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.hasCoverSheet ? "bg-blue-500" : "bg-gray-300"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.hasCoverSheet ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </button>
            </div>

            {form.hasCoverSheet && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Cover Page Template</label>
                {templates.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={form.coverSheetTemplateId}
                      onChange={(e) => applyTemplate(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Default cover sheet (no template)</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}{t.isDefault ? " (default)" : ""}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => setActiveTab("advanced")} className="text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap">
                      Edit fields
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 border border-dashed border-gray-300 rounded px-3 py-2">
                    No templates yet — a default cover sheet will be used. Create one under{" "}
                    <a href="/templates" className="text-blue-600 hover:underline">Cover Sheets</a>, or{" "}
                    <button type="button" onClick={() => setActiveTab("advanced")} className="text-blue-600 hover:underline">edit the fields</button>.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* File upload */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Upload Attachments{" "}
              <span className="text-gray-400 font-normal">Maximum 50mb file size</span>
            </label>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded px-6 py-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-blue-400 bg-blue-50"
                  : file
                  ? "border-green-400 bg-green-50"
                  : "border-gray-300 hover:border-gray-400 bg-white"
              }`}
            >
              <input {...getInputProps()} />
              {file ? (
                <div>
                  <p className="text-sm font-medium text-green-700">{file.name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {(file.size / 1024).toFixed(0)} KB · Click to replace
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-gray-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <span className="text-sm">
                    {isDragActive ? "Drop it here" : (
                      <>Drop files here or <strong className="text-gray-700">browse</strong></>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {status === "error" && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {errorMsg}
            </p>
          )}

          {/* Send button */}
          <button
            type="submit"
            disabled={recipients.every((r) => !r.number.trim()) || status === "sending" || status === "success"}
            className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold rounded transition-colors flex items-center justify-center gap-2"
          >
            {status === "sending" ? "Sending…" : (
              <>
                {isScheduled
                  ? "Schedule Fax"
                  : isBroadcast
                  ? `Send to ${recipients.filter((r) => r.number).length} Recipients`
                  : "Send Fax"}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </div>
      )}

      {/* ── CONTACTS TAB ── */}
      {activeTab === "contacts" && (
        <div className="flex flex-col" style={{ minHeight: "420px" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">
              Filling slot{" "}
              <span className="font-semibold text-gray-800">#{activeRecipientIdx + 1}</span>
              {recipients[activeRecipientIdx]?.number && (
                <span className="ml-2 text-gray-400">
                  (currently: {recipients[activeRecipientIdx].number})
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={addRecipient}
              className="text-xs text-blue-600 hover:underline"
            >
              + Add slot
            </button>
          </div>

          {/* Slot pills */}
          {recipients.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {recipients.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveRecipientIdx(i)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    activeRecipientIdx === i
                      ? "bg-blue-100 border-blue-400 text-blue-700"
                      : "bg-gray-100 border-gray-300 text-gray-600 hover:border-blue-300"
                  }`}
                >
                  {r.name || r.number || `Slot ${i + 1}`}
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="mb-2">
            <input
              type="text"
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              placeholder="Search contacts…"
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Contact list */}
          <div className="flex-1 border border-gray-200 rounded-lg overflow-y-auto divide-y divide-gray-50" style={{ maxHeight: "360px" }}>
            {contacts.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">
                No contacts yet. Add some in the Contacts section.
              </p>
            ) : filteredContacts.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">No matches for "{contactSearch}"</p>
            ) : (
              filteredContacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pickContact(c)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 text-left transition-colors"
                >
                  <div>
                    <span className="text-sm font-medium text-gray-900">{c.name}</span>
                    {c.company && (
                      <span className="text-xs text-gray-400 ml-2">{c.company}</span>
                    )}
                  </div>
                  <span className="font-mono text-xs text-gray-500">{c.faxNumber}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── ADVANCED TAB ── */}
      {activeTab === "advanced" && (
        <div className="space-y-5">
          {/* Template selector */}
          {templates.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Cover Sheet Template</label>
              <select
                value={form.coverSheetTemplateId}
                onChange={(e) => {
                  if (e.target.value) applyTemplate(e.target.value)
                  else set("coverSheetTemplateId", "")
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— No template —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Selecting a template fills the fields below and associates it with this fax.</p>
            </div>
          )}

          {/* Cover sheet fields — only when enabled */}
          {form.hasCoverSheet ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Subject</label>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(e) => set("subject", e.target.value)}
                    placeholder="Subject"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Receiver Name</label>
                  <input
                    type="text"
                    value={recipients[0]?.name ?? ""}
                    onChange={(e) => updateRecipient(0, "name", e.target.value)}
                    placeholder="Receiver Name"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Cover Sheet Message</label>
                <textarea
                  value={form.coverSheetMessage}
                  onChange={(e) => set("coverSheetMessage", e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Your Contact Info{" "}
                  <span className="text-gray-400 font-normal">Phone number, company, address, email, etc.</span>
                </label>
                <textarea
                  value={form.contactInfo}
                  onChange={(e) => set("contactInfo", e.target.value)}
                  rows={4}
                  placeholder="Contact Information"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
              </div>
            </>
          ) : (
            <div className="rounded bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-500">
              Cover sheet is disabled. Enable it on the{" "}
              <button
                type="button"
                onClick={() => setActiveTab("send")}
                className="text-blue-600 hover:underline"
              >
                Send Fax
              </button>{" "}
              tab to edit these fields.
            </div>
          )}

          {/* Page Size + Resolution */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Page Size</label>
              <select
                value={form.pageSize}
                onChange={(e) => set("pageSize", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="letter">Letter</option>
                <option value="legal">Legal</option>
                <option value="a4">A4</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Resolution</label>
              <select
                value={form.resolution}
                onChange={(e) => set("resolution", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="fine">Fine (Best quality)</option>
                <option value="standard">Standard</option>
              </select>
            </div>
          </div>

          {/* Schedule Send */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <label className="block text-sm font-semibold text-gray-700">Schedule Send</label>
              <button
                type="button"
                onClick={() =>
                  set(
                    "scheduledAt",
                    form.scheduledAt ? "" : new Date(Date.now() + 3600000).toISOString().slice(0, 16)
                  )
                }
                className="text-xs text-blue-600 hover:underline"
              >
                {form.scheduledAt ? "Cancel — send now" : "+ Schedule for later"}
              </button>
            </div>
            {form.scheduledAt && (
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => set("scheduledAt", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
        </div>
      )}

      {/* ── PREVIEW TAB ── */}
      {activeTab === "preview" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Exactly what will be transmitted — cover sheet{file ? " + attached PDF" : ""}.
            </p>
            <button
              type="button"
              onClick={generatePreview}
              disabled={previewLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${previewLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {previewLoading ? "Rendering…" : "Refresh"}
            </button>
          </div>

          {previewError ? (
            <div className="rounded bg-amber-50 border border-amber-200 px-4 py-4 text-sm text-amber-800">
              {previewError}
              {!form.hasCoverSheet && !file && (
                <span> Enable the cover sheet on the{" "}
                  <button type="button" onClick={() => setActiveTab("send")} className="text-blue-600 hover:underline">Send Fax</button>{" "}
                  tab or attach a PDF.</span>
              )}
            </div>
          ) : previewLoading && !previewUrl ? (
            <div className="border border-gray-200 rounded-lg h-[820px] flex items-center justify-center text-sm text-gray-400">
              Rendering preview…
            </div>
          ) : previewUrl ? (
            <iframe
              src={previewUrl}
              title="Fax preview"
              className="w-full h-[820px] border border-gray-300 rounded-lg bg-gray-50"
            />
          ) : (
            <div className="border border-gray-200 rounded-lg h-[820px] flex items-center justify-center text-sm text-gray-400">
              No preview yet.
            </div>
          )}
        </div>
      )}

      {/* ── IMPORT LIST TAB ── */}
      {activeTab === "import" && (
        <div className="space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 mb-1">Import Recipients from CSV</h2>
            <p className="text-xs text-gray-500">
              Upload a CSV file with columns: <code className="bg-gray-100 px-1 rounded">number, name</code> (name is optional).
              Each row becomes a recipient.
            </p>
          </div>

          {/* CSV file drop area */}
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg px-6 py-8 text-center cursor-pointer hover:border-blue-400 transition-colors bg-white"
            onClick={() => csvFileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const f = e.dataTransfer.files[0]
              if (f) handleCsvFile(f)
            }}
          >
            <input
              ref={csvFileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleCsvFile(f)
              }}
            />
            <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-sm text-gray-600">
              Drop a <strong>.csv</strong> file here or <span className="text-blue-600 font-medium">browse</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">e.g. 15551234567, Dr. Smith</p>
          </div>

          {/* Or paste manually */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Or paste CSV text
            </label>
            <textarea
              value={csvPasteText}
              onChange={(e) => handleCsvPaste(e.target.value)}
              rows={5}
              placeholder={"15551234567, Dr. Smith\n15559876543, Jane Doe\n15550001111"}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>

          {/* Preview table */}
          {csvPreview.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Preview — {csvPreview.length} recipient{csvPreview.length > 1 ? "s" : ""}
              </p>
              <div className="border border-gray-200 rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-8">#</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Number</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Name</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {csvPreview.slice(0, 20).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 text-xs text-gray-400">{i + 1}</td>
                        <td className="px-3 py-1.5 font-mono text-gray-900">{row.number}</td>
                        <td className="px-3 py-1.5 text-gray-600">{row.name || <span className="text-gray-300 italic">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvPreview.length > 20 && (
                  <p className="text-xs text-gray-400 px-3 py-2 border-t border-gray-100">
                    … and {csvPreview.length - 20} more rows
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={applyCsvImport}
                className="mt-3 w-full py-2.5 px-4 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded transition-colors"
              >
                Apply — set {csvPreview.length} recipient{csvPreview.length > 1 ? "s" : ""}
              </button>
            </div>
          )}

          {csvPreview.length === 0 && csvPasteText.length > 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              No valid rows found. Make sure each line has at least a phone number.
            </p>
          )}
        </div>
      )}
    </form>
  )
}
