"use client"

import { useState } from "react"
import { showToast } from "@/components/toast"

export default function ContactPage() {
  const [form, setForm] = useState({ subject: "", message: "" })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    await new Promise((r) => setTimeout(r, 700))
    setSending(false)
    setSent(true)
    showToast("Message sent — we'll respond within 1 business day.", "success")
  }

  const cls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="max-w-2xl">
      <div className="flex items-baseline gap-3 mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Contact Us</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        {[
          { icon: "📧", label: "Email Support", value: "support@caretend.com", sub: "Responses within 1 business day" },
          { icon: "📞", label: "Phone", value: "(800) 555-0100", sub: "Mon–Fri, 9am–6pm ET" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <div className="text-2xl mb-2">{c.icon}</div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.label}</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">{c.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {sent ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <svg className="w-10 h-10 text-green-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-sm font-semibold text-green-800">Message sent!</h2>
          <p className="text-xs text-green-700 mt-1">We&apos;ll get back to you within 1 business day.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Send us a message</h2>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Subject *</label>
            <input required type="text" value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="e.g. Question about my account" className={cls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Message *</label>
            <textarea required rows={5} value={form.message} onChange={(e) => set("message", e.target.value)} placeholder="Describe your question or issue…" className={`${cls} resize-y`} />
          </div>
          <button type="submit" disabled={sending} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
            {sending ? "Sending…" : "Send Message"}
          </button>
        </form>
      )}
    </div>
  )
}
