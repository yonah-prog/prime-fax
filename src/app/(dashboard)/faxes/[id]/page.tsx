import { db } from "@/lib/db"
import { faxes } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import Link from "next/link"
import StatusBadge from "@/components/status-badge"
import FaxDetailActions from "@/components/fax-detail-actions"

export const dynamic = "force-dynamic"

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div className="flex gap-4 py-3 border-b border-gray-100 last:border-0">
      <span className="w-40 shrink-0 text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-900 break-all">{value}</span>
    </div>
  )
}

export default async function FaxDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const fax = await db.query.faxes.findFirst({ where: eq(faxes.id, id) })
  if (!fax) notFound()

  const backHref = fax.direction === "inbound" ? "/inbox" : fax.trashedAt ? "/trash" : "/sent"
  const backLabel = fax.direction === "inbound" ? "Inbox" : fax.trashedAt ? "Trash" : "Sent"

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={backHref} className="text-sm text-blue-600 hover:underline">← {backLabel}</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-500">Fax Detail</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-4 gap-4">
          <h1 className="text-lg font-semibold text-gray-900 capitalize">
            {fax.direction === "inbound" ? "Received" : "Sent"} Fax
          </h1>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <StatusBadge status={fax.status} />
            {/* Client-side actions: retry, resend, mark read/unread, download, notes */}
            <FaxDetailActions fax={{
              id: fax.id,
              status: fax.status,
              direction: fax.direction,
              fileUrl: fax.fileUrl,
              fileName: fax.fileName,
              readAt: fax.readAt?.toISOString() ?? null,
              notes: fax.notes,
              toNumber: fax.toNumber,
            }} />
          </div>
        </div>

        <div>
          <Row label="From" value={<span className="font-mono">{fax.fromNumber}</span>} />
          <Row label="From Name" value={fax.fromName} />
          <Row label="To" value={<span className="font-mono">{fax.toNumber}</span>} />
          <Row label="Recipient Name" value={fax.recipientName} />
          <Row label="Subject" value={fax.subject} />
          <Row label="Pages" value={fax.pages?.toString()} />
          <Row label="Page Size" value={fax.pageSize} />
          <Row label="Resolution" value={fax.resolution} />
          <Row label="Cover Sheet" value={fax.hasCoverSheet ? "Yes" : "No"} />
          {fax.scheduledAt && <Row label="Scheduled" value={new Date(fax.scheduledAt).toLocaleString()} />}
          <Row label="Telnyx Fax ID" value={<span className="font-mono text-xs">{fax.telnyxFaxId}</span>} />
          <Row label="Sent At" value={new Date(fax.createdAt).toLocaleString()} />
          <Row label="Read" value={fax.readAt ? new Date(fax.readAt).toLocaleString() : fax.direction === "inbound" ? "Unread" : null} />
          {fax.errorMessage && (
            <Row label="Error" value={<span className="text-red-600">{fax.errorMessage}</span>} />
          )}
        </div>
      </div>

      {fax.fileUrl && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">{fax.fileName ?? "Fax Document"}</span>
            <div className="flex gap-3">
              <a href={`/api/faxes/${fax.id}/file`} download={fax.fileName ?? "fax.pdf"}
                className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Download
              </a>
              <a href={`/api/faxes/${fax.id}/file`} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:underline">
                Open →
              </a>
            </div>
          </div>
          <iframe src={`/api/faxes/${fax.id}/file`} className="w-full" style={{ height: "70vh" }} title="Fax document preview" />
        </div>
      )}
    </div>
  )
}
