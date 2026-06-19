const styles: Record<string, string> = {
  queued:    "bg-gray-100 text-gray-600",
  sending:   "bg-blue-100 text-blue-700",
  delivered: "bg-green-100 text-green-700",
  failed:    "bg-red-100 text-red-700",
  received:  "bg-purple-100 text-purple-700",
  scheduled: "bg-amber-100 text-amber-700",
}

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${styles[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  )
}
