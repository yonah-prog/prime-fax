"use client"

import { useState, useEffect } from "react"
import { showToast } from "@/components/toast"

type Tab = "general" | "email" | "coversheet"

const tabs: { id: Tab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "email", label: "Email & 💬" },
  { id: "coversheet", label: "Cover Sheet" },
]

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
const selectCls = inputCls
const labelCls = "block text-sm font-medium text-gray-700 mb-1"

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mt-7 mb-4">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  )
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${checked ? "bg-blue-400" : "bg-gray-200"} ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  )
}

function ToggleRow({
  label, description, checked, onChange,
}: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-50 last:border-0">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-900">{label}</div>
        {description && <div className="text-sm text-gray-500 mt-0.5">{description}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

// ─────────────────────────────────────────
// General Tab
// ─────────────────────────────────────────
function GeneralTab() {
  const [name, setName] = useState("")
  const [timezone, setTimezone] = useState("America/New_York")
  const [defaultPage, setDefaultPage] = useState("/sent")
  const [markAsRead, setMarkAsRead] = useState("any")
  const [downloadFormat, setDownloadFormat] = useState("pdf")
  const [defaultPageSize, setDefaultPageSize] = useState("letter")
  const [defaultResolution, setDefaultResolution] = useState("fine")
  const [secureMode, setSecureMode] = useState<"disabled" | "enabled">("disabled")
  const [require2FA, setRequire2FA] = useState("disabled")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/settings/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.name !== undefined) setName(data.name ?? "")
        if (data.timezone !== undefined) setTimezone(data.timezone ?? "America/New_York")
        if (data.defaultPage !== undefined) setDefaultPage(data.defaultPage ?? "/sent")
        if (data.markAsRead !== undefined) setMarkAsRead(data.markAsRead ?? "any")
        if (data.downloadFormat !== undefined) setDownloadFormat(data.downloadFormat ?? "pdf")
        if (data.defaultPageSize !== undefined) setDefaultPageSize(data.defaultPageSize ?? "letter")
        if (data.defaultResolution !== undefined) setDefaultResolution(data.defaultResolution ?? "fine")
        if (data.secureMode !== undefined) setSecureMode(data.secureMode ? "enabled" : "disabled")
        if (data.require2FA !== undefined) setRequire2FA(data.require2FA ? "email" : "disabled")
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch("/api/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        timezone,
        defaultPage,
        markAsRead,
        downloadFormat,
        defaultPageSize,
        defaultResolution,
        secureMode: secureMode === "enabled",
        require2FA: require2FA !== "disabled",
      }),
    })
    setSaving(false)
    if (res.ok) showToast("Settings saved")
    else showToast("Failed to save", "error")
  }

  if (loading) {
    return <div className="py-8 text-sm text-gray-400">Loading…</div>
  }

  return (
    <form onSubmit={saveProfile} className="space-y-4 max-w-xl">
      <div>
        <label className={labelCls}>Full Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Your Name" />
      </div>
      <div>
        <label className={labelCls}>Email</label>
        <input type="email" disabled className={`${inputCls} bg-gray-50 text-gray-400 cursor-not-allowed`} placeholder="your@email.com" />
        <p className="text-xs text-gray-400 mt-1">Contact your admin to change the account email.</p>
      </div>
      <div>
        <label className={labelCls}>Time Zone</label>
        <select className={selectCls} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
          <option value="America/New_York">(GMT −04:00) Eastern Time — New York</option>
          <option value="America/Chicago">(GMT −05:00) Central Time — Chicago</option>
          <option value="America/Denver">(GMT −06:00) Mountain Time — Denver</option>
          <option value="America/Los_Angeles">(GMT −07:00) Pacific Time — Los Angeles</option>
          <option value="America/Anchorage">(GMT −08:00) Alaska Time</option>
          <option value="Pacific/Honolulu">(GMT −10:00) Hawaii Time</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Outbound Fax Number</label>
        <select className={selectCls}><option value="">Default</option></select>
        <p className="text-xs text-gray-400 mt-1">Default number used when sending faxes.</p>
      </div>
      <div>
        <label className={labelCls}>Default Dashboard Page</label>
        <select className={selectCls} value={defaultPage} onChange={(e) => setDefaultPage(e.target.value)}>
          <option value="/sent">Sent Faxes</option>
          <option value="/inbox">Received Faxes</option>
          <option value="/dashboard">Dashboard</option>
          <option value="/send">Compose</option>
        </select>
        <p className="text-xs text-gray-400 mt-1">Page shown after logging in or sending a fax.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Outbound Page Size</label>
          <select className={selectCls} value={defaultPageSize} onChange={(e) => setDefaultPageSize(e.target.value)}>
            <option value="letter">Letter</option>
            <option value="legal">Legal</option>
            <option value="a4">A4</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Outbound Resolution</label>
          <select className={selectCls} value={defaultResolution} onChange={(e) => setDefaultResolution(e.target.value)}>
            <option value="fine">Fine (Best quality)</option>
            <option value="standard">Standard</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Mark as Read</label>
          <select className={selectCls} value={markAsRead} onChange={(e) => setMarkAsRead(e.target.value)}>
            <option value="any">Read by Any User</option>
            <option value="self">Read by Recipient Only</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Fax File Download Format</label>
          <select className={selectCls} value={downloadFormat} onChange={(e) => setDownloadFormat(e.target.value)}>
            <option value="pdf">PDF</option>
          </select>
        </div>
      </div>

      <div className="mt-7 mb-4 border-t border-gray-100 pt-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Security Settings</h2>
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span>🔒</span>
              <label className={`${labelCls} mb-0`}>Secure Mode</label>
            </div>
            <p className="text-xs text-gray-500 mb-2">No Attachments In Emails</p>
            <select
              className={`${selectCls} max-w-xs`}
              value={secureMode}
              onChange={(e) => setSecureMode(e.target.value as "disabled" | "enabled")}
            >
              <option value="disabled">Disabled</option>
              <option value="enabled">Enabled</option>
            </select>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span>🔒</span>
              <label className={`${labelCls} mb-0`}>Two-Factor Authentication</label>
            </div>
            <p className="text-xs text-gray-500 mb-2">Send a numeric code to your cell phone or email / use authenticator app.</p>
            <select
              className={`${selectCls} max-w-xs`}
              value={require2FA}
              onChange={(e) => setRequire2FA(e.target.value)}
            >
              <option value="disabled">Disabled</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="totp">Authenticator App</option>
            </select>
          </div>
        </div>
      </div>

      <div className="pt-2">
        <button type="submit" disabled={saving}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────
// Email & Notifications Tab
// ─────────────────────────────────────────
function EmailTab() {
  const [prefs, setPrefs] = useState({
    // Email to Fax
    inlineAttachments: true,
    htmlAsAttachment: false,
    // Email Notifications
    completionReceipt: false,
    sendingStarted: false,
    previewInEmail: false,
    receiveFaxAsEmail: true,
    onlyAssignedEmail: false,
    // Dashboard Notifications
    dashInboundStart: true,
    dashInboundReceived: true,
    dashSentCompleted: true,
    dashOnlyAssigned: false,
  })
  const [notifyEmail, setNotifyEmail] = useState("")
  const [saving, setSaving] = useState(false)

  function set(key: keyof typeof prefs, val: boolean) {
    setPrefs((p) => ({ ...p, [key]: val }))
  }

  async function save() {
    setSaving(true)
    const res = await fetch("/api/settings/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notifyInbound: prefs.receiveFaxAsEmail, notifyEmail }),
    })
    setSaving(false)
    if (res.ok) showToast("Notification preferences saved")
    else showToast("Failed to save", "error")
  }

  return (
    <div className="max-w-2xl">
      <SectionHeader title="Email to Fax" />
      <div className="bg-gray-50 rounded-lg px-4">
        <ToggleRow label="Use Inline (Embedded) Email Attachments" description="Disable if you have images in your email signature that are getting sent." checked={prefs.inlineAttachments} onChange={(v) => set("inlineAttachments", v)} />
        <ToggleRow label="Create Attachment from HTML Email" description="HTML formatted email sent as attachment instead of cover sheet." checked={prefs.htmlAsAttachment} onChange={(v) => set("htmlAsAttachment", v)} />
      </div>

      <SectionHeader title="Email Notifications" />
      <div className="bg-gray-50 rounded-lg px-4">
        <ToggleRow label="Completion Receipt For Outgoing Faxes" description="Success / failure & other details." checked={prefs.completionReceipt} onChange={(v) => set("completionReceipt", v)} />
        <ToggleRow label="Notification When Fax Starts Sending" description="Only for faxes sent through email." checked={prefs.sendingStarted} onChange={(v) => set("sendingStarted", v)} />
        <ToggleRow label="Preview Image in Notifications" description="Include preview image of fax in outbound and inbound fax notifications." checked={prefs.previewInEmail} onChange={(v) => set("previewInEmail", v)} />
        <ToggleRow label="Receive Inbound Faxes as Email" description="Includes preview image (if not disabled) and pdf file if secure mode disabled." checked={prefs.receiveFaxAsEmail} onChange={(v) => set("receiveFaxAsEmail", v)} />
        <ToggleRow label="Only Receive Email Notifications for Assigned Fax Number" description="Only receive email notifications for faxes on main (assigned) number." checked={prefs.onlyAssignedEmail} onChange={(v) => set("onlyAssignedEmail", v)} />
      </div>

      {prefs.receiveFaxAsEmail && (
        <div className="mt-3">
          <label className={labelCls}>
            Notification email <span className="text-gray-400 font-normal">(leave blank to use account email)</span>
          </label>
          <input type="email" value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)}
            placeholder="override@example.com" className={`${inputCls} max-w-sm`} />
        </div>
      )}

      <SectionHeader title="Dashboard Notifications" subtitle="Notifications that pop up when logged into dashboard" />
      <div className="bg-gray-50 rounded-lg px-4">
        <ToggleRow label="Inbound Fax Begin Transmission" description='When an inbound fax "negotiates" with our system.' checked={prefs.dashInboundStart} onChange={(v) => set("dashInboundStart", v)} />
        <ToggleRow label="Inbound Fax Received" description="Inbound fax with one or more pages received." checked={prefs.dashInboundReceived} onChange={(v) => set("dashInboundReceived", v)} />
        <ToggleRow label="Sent Fax Completed" description="Success or failure will be reported." checked={prefs.dashSentCompleted} onChange={(v) => set("dashSentCompleted", v)} />
        <ToggleRow label="Only Receive Notifications for Assigned Number" description="Accounts with many numbers can receive too many notifications." checked={prefs.dashOnlyAssigned} onChange={(v) => set("dashOnlyAssigned", v)} />
      </div>

      <div className="pt-6 border-t border-gray-100 mt-7">
        <SectionHeader title="Change Password" />
        <PasswordForm />
      </div>

      <div className="pt-4">
        <button onClick={save} disabled={saving}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// Cover Sheet Tab
// ─────────────────────────────────────────
function CoverSheetTab() {
  const HIPAA = "This fax contains confidential information intended only for the designated recipient(s). If you received this fax in error, please notify the sender immediately and destroy all copies. Do not disclose, copy, or distribute without authorization. (45 CFR 164.530)"

  const [sendAuto, setSendAuto] = useState(true)
  const [includeUrl, setIncludeUrl] = useState(false)
  const [address, setAddress] = useState("")
  const [message, setMessage] = useState(HIPAA)
  const [saving, setSaving] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Default",
        contactInfo: address,
        coverSheetMessage: message,
        isDefault: true,
      }),
    })
    setSaving(false)
    showToast("Cover sheet saved")
  }

  return (
    <form onSubmit={save} className="max-w-2xl">
      <p className="text-sm text-gray-600 mb-5">
        A{" "}
        <span className="underline decoration-amber-400 underline-offset-2 cursor-pointer">cover sheet</span>
        {" "}is typically sent with outgoing faxes.
      </p>

      <div className="bg-gray-50 rounded-lg px-4 mb-5">
        <ToggleRow label="Send Cover Sheet Automatically" description="Use the subject and body of the email to populate the cover sheet." checked={sendAuto} onChange={setSendAuto} />
        <ToggleRow label="Include Web URL to Download Fax" description="Include unique web URL at bottom of cover sheet where receiver can download the fax as a pdf file." checked={includeUrl} onChange={setIncludeUrl} />
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-0.5">Company / Address Text</label>
          <p className="text-sm text-gray-500 mb-2">Phone number, company, address, email, etc.</p>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Company / Address"
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-0.5">Default Cover Sheet Message</label>
          <p className="text-sm text-gray-500 mb-2">Only used in the compose fax page. Email faxing will use the body of your email for the cover sheet message.</p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </div>
      </div>

      <div className="pt-5">
        <button type="submit" disabled={saving}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────
// Change Password (shared)
// ─────────────────────────────────────────
function PasswordForm() {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "err">("idle")
  const [msg, setMsg] = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (next !== confirm) { setMsg("Passwords do not match"); setStatus("err"); return }
    setStatus("saving"); setMsg("")
    const res = await fetch("/api/settings/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    })
    if (res.ok) {
      setStatus("ok"); setMsg("Password updated.")
      setCurrent(""); setNext(""); setConfirm("")
      showToast("Password updated")
    } else {
      const data = await res.json().catch(() => ({}))
      setMsg(data.error ?? "Failed to update password")
      setStatus("err")
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 max-w-md">
      {msg && (
        <p className={`text-sm rounded px-3 py-2 border ${status === "ok" ? "text-green-700 bg-green-50 border-green-200" : "text-red-700 bg-red-50 border-red-200"}`}>
          {msg}
        </p>
      )}
      <div>
        <label className={labelCls}>Current Password</label>
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>New Password</label>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Confirm</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className={inputCls} />
        </div>
      </div>
      <button type="submit" disabled={status === "saving"}
        className="px-5 py-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
        {status === "saving" ? "Saving…" : "Update Password"}
      </button>
    </form>
  )
}

// ─────────────────────────────────────────
// Page
// ─────────────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("general")

  // Honor deep links from the sidebar (e.g. /settings?tab=email).
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab")
    if (tab === "general" || tab === "email" || tab === "coversheet") setActiveTab(tab)
  }, [])

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <span className="text-sm text-gray-400 border-l border-gray-200 pl-3">
          {tabs.find((t) => t.id === activeTab)?.label}
        </span>
      </div>

      <div className="flex mb-6 rounded-lg overflow-hidden border border-gray-200 w-fit">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-6 py-2 text-sm font-medium transition-colors ${i > 0 ? "border-l border-gray-200" : ""} ${activeTab === t.id ? "bg-blue-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {activeTab === "general" && <GeneralTab />}
        {activeTab === "email" && <EmailTab />}
        {activeTab === "coversheet" && <CoverSheetTab />}
      </div>
    </div>
  )
}
