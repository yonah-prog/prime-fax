import { db } from "@/lib/db"
import { faxes, users, phoneNumbers } from "@/lib/db/schema"
import { and, count, eq, isNull, sql } from "drizzle-orm"
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function BillingPage() {
  const session = await auth()
  if (!session || (session.user as { role?: string })?.role !== "admin") redirect("/sent")

  const [totalSent, totalReceived, totalPages, userCount, numberCount] = await Promise.all([
    db.select({ v: count() }).from(faxes).where(and(eq(faxes.direction, "outbound"), isNull(faxes.trashedAt))),
    db.select({ v: count() }).from(faxes).where(and(eq(faxes.direction, "inbound"), isNull(faxes.trashedAt))),
    db.select({ v: sql<number>`COALESCE(SUM(${faxes.pages}), 0)::int` }).from(faxes).where(isNull(faxes.trashedAt)),
    db.select({ v: count() }).from(users),
    db.select({ v: count() }).from(phoneNumbers).where(eq(phoneNumbers.active, true)),
  ])

  const stats = [
    { label: "Faxes Sent", value: (totalSent[0]?.v ?? 0).toLocaleString() },
    { label: "Faxes Received", value: (totalReceived[0]?.v ?? 0).toLocaleString() },
    { label: "Total Pages", value: (totalPages[0]?.v ?? 0).toLocaleString() },
    { label: "Active Users", value: (userCount[0]?.v ?? 0).toLocaleString() },
    { label: "Phone Numbers", value: (numberCount[0]?.v ?? 0).toLocaleString() },
  ]

  return (
    <div className="max-w-3xl">
      <div className="flex items-baseline gap-3 mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Billing & Usage</h1>
        <span className="text-sm text-gray-400 border-l border-gray-200 pl-3">Account Overview</span>
      </div>

      {/* Usage summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Plan info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Current Plan</h2>
            <p className="text-xs text-gray-500 mt-0.5">All fax volume is billed through your carrier account</p>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
            Enterprise
          </span>
        </div>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Unlimited fax numbers
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Unlimited users
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            HIPAA-compliant storage
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            API access & webhooks
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 text-sm text-blue-800">
        <p className="font-medium mb-1">Need to adjust your plan or view invoices?</p>
        <p className="text-blue-700 text-xs">Contact your account manager or reach out via the Contact Us page.</p>
      </div>
    </div>
  )
}
