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
  const [saving, setSaving] = useState(false)

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch("/api/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    setSaving(false)
    if (res.ok) showToast("Settings saved")
    else showToast("Failed to save", "error")
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
        <select className={selectCls} defaultValue="America/New_York">
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
        <select className={selectCls} defaultValue="/sent">
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
          <select className={selectCls} defaultValue="letter">
            <option value="letter">Letter</option>
            <option value="legal">Legal</option>
            <option value="a4">A4</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Outbound Resolution</label>
          <select className={selectCls} defaultValue="fine">
            <option value="fine">Fine (Best quality)</option>
            <option value="standard">Standard</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Mark as Read</label>
          <select className={selectCls} defaultValue="any">
            <option value="any">Read by Any User</option>
            <option value="self">Read by Recipient Only</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Fax File Download Format</label>
          <select className={selectCls} defaultValue="pdf">
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
            <select className={`${selectCls} max-w-xs`} defaultValue="disabled">
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
            <select className={`${selectCls} max-w-xs`} defaultValue="disabled">
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
// Google Drive Connector
// ─────────────────────────────────────────
function GoogleDriveConnector() {
  const [status, setStatus] = useState<{ configured: boolean; connected: boolean; folder: string } | null>(null)
  const [folder, setFolder] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/settings/google")
      .then((r) => r.json())
      .then((data) => { setStatus(data); if (data.folder) setFolder(data.folder) })
      .catch(() => setStatus({ configured: false, connected: false, folder: "" }))
  }, [])

  async function disconnect() {
    setSaving(true)
    await fetch("/api/settings/google", { method: "DELETE" })
    setSaving(false)
    setStatus((s) => s ? { ...s, connected: false } : s)
    showToast("Google Drive disconnected")
  }

  async function saveFolder() {
    setSaving(true)
    await fetch("/api/settings/google", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder }),
    })
    setSaving(false)
    showToast("Folder saved")
  }

  if (!status) return <p className="text-sm text-gray-400">Loading…</p>

  if (!status.configured) return (
    <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
      Google OAuth not configured — add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local.
    </p>
  )

  if (!status.connected) return (
    <a href="/api/auth/google"
      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm w-fit">
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      Connect Google Drive
    </a>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Connected
        </span>
        <button onClick={disconnect} disabled={saving}
          className="text-sm text-red-600 hover:underline disabled:opacity-50">
          Disconnect
        </button>
      </div>
      <div className="flex gap-2 items-center">
        <input type="text" value={folder} onChange={(e) => setFolder(e.target.value)}
          placeholder="CareTend Fax"
          className={`${inputCls} max-w-xs`} />
        <button onClick={saveFolder} disabled={saving}
          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors whitespace-nowrap">
          Save Folder
        </button>
      </div>
      <p className="text-xs text-gray-400">Faxes are uploaded to this folder name in your Drive. Defaults to "CareTend Fax".</p>
    </div>
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

      <SectionHeader title="Cloud Services" subtitle="Automatically upload a PDF of incoming and outgoing faxes to your cloud accounts." />
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
              <path d="M6 18L2 12l4-6h5L7 12l4 6H6zM13 18l-4-6 4-6h5l-4 6 4 6h-5z" fill="#0061FF"/>
            </svg>
            <span className="text-sm font-bold text-gray-900">Dropbox</span>
            <span className="text-xs text-gray-400 bg-gray-100 rounded px-2 py-0.5">Coming soon</span>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="text-sm font-bold text-gray-900">Google Drive</span>
          </div>
          <GoogleDriveConnector />
        </div>
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
