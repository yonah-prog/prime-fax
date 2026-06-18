"use client"

import { useState } from "react"
import { showToast } from "@/components/toast"

const steps = [
  {
    n: 1,
    title: "Verify eligibility",
    body: "Your number must be active with your current carrier and not under a contract lock. VoIP fax numbers and toll-free numbers are both supported.",
  },
  {
    n: 2,
    title: "Gather your information",
    body: "You'll need: the full phone number to transfer, your current carrier's name, your account number with them, and the billing PIN or last 4 digits of SSN on the account.",
  },
  {
    n: 3,
    title: "Submit the form below",
    body: "We'll initiate the Letter of Authorization (LOA) process with your carrier. Transfers typically complete within 5–10 business days.",
  },
  {
    n: 4,
    title: "Keep your number active",
    body: "Do not cancel service with your current carrier until the transfer is confirmed complete. Cancelling early will result in the number being lost.",
  },
]

export default function NumberTransferPage() {
  const [form, setForm] = useState({
    phoneNumber: "",
    currentCarrier: "",
    accountNumber: "",
    pin: "",
    authorizedName: "",
    notes: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 800))
    setSubmitting(false)
    setSubmitted(true)
    showToast("Transfer request submitted — we'll be in touch within 1 business day.", "success")
  }

  const cls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Number Transfer</h1>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700">
          NEW
        </span>
      </div>

      <p className="text-sm text-gray-600 mb-6">
        Transfer (port) an existing fax number from your current carrier to CareTend Fax. The process is free and your number stays the same throughout.
      </p>

      {/* Steps */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">How it works</h2>
        <div className="space-y-4">
          {steps.map((s) => (
            <div key={s.n} className="flex gap-4">
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {s.n}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{s.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      {submitted ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <svg className="w-10 h-10 text-green-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-base font-semibold text-green-800 mb-1">Request received!</h2>
          <p className="text-sm text-green-700">Our team will review your request and contact you within 1 business day to begin the transfer process.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Submit a transfer request</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number to Transfer *</label>
              <input required type="tel" placeholder="+12125551234" value={form.phoneNumber} onChange={(e) => set("phoneNumber", e.target.value)} className={cls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Current Carrier *</label>
              <input required type="text" placeholder="e.g. AT&T, Verizon, RingCentral" value={form.currentCarrier} onChange={(e) => set("currentCarrier", e.target.value)} className={cls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Account Number with Carrier *</label>
              <input required type="text" value={form.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} className={cls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Billing PIN / Last 4 of SSN *</label>
              <input required type="text" maxLength={10} value={form.pin} onChange={(e) => set("pin", e.target.value)} className={cls} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Authorized Contact Name *</label>
              <input required type="text" placeholder="Name on the account" value={form.authorizedName} onChange={(e) => set("authorizedName", e.target.value)} className={cls} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Additional Notes</label>
              <textarea rows={3} placeholder="Any additional information about the transfer…" value={form.notes} onChange={(e) => set("notes", e.target.value)} className={`${cls} resize-y`} />
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
            By submitting this form you authorize CareTend Fax to act as your agent to port this number on your behalf.
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {submitting ? "Submitting…" : "Submit Transfer Request"}
          </button>
        </form>
      )}
    </div>
  )
}
