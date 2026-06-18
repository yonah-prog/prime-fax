export default function FileFormatsPage() {
  const formats = [
    { ext: "PDF", mime: "application/pdf", send: true, receive: true, notes: "Recommended. Multi-page supported, all page sizes." },
    { ext: "TIFF", mime: "image/tiff", send: true, receive: true, notes: "Standard fax format. Single or multi-page." },
    { ext: "PNG", mime: "image/png", send: true, receive: false, notes: "Single page only. Converted to PDF before sending." },
    { ext: "JPEG", mime: "image/jpeg", send: true, receive: false, notes: "Single page only. Converted to PDF before sending." },
  ]

  const limits = [
    { label: "Max file size", value: "50 MB per upload" },
    { label: "Max pages", value: "No hard limit (carrier limits may apply)" },
    { label: "Page sizes", value: "Letter (8.5×11), Legal (8.5×14), A4" },
    { label: "Resolution", value: "Fine (200dpi) or Standard (100dpi)" },
  ]

  return (
    <div className="max-w-3xl">
      <div className="flex items-baseline gap-3 mb-6">
        <h1 className="text-xl font-semibold text-gray-900">File Formats</h1>
        <span className="text-sm text-gray-400 border-l border-gray-200 pl-3">Supported file types</span>
      </div>

      {/* Format table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Accepted Formats</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left">
              <th className="px-5 py-3">Format</th>
              <th className="px-5 py-3">Send</th>
              <th className="px-5 py-3">Receive</th>
              <th className="px-5 py-3">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {formats.map((f) => (
              <tr key={f.ext} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <span className="inline-block bg-gray-100 text-gray-700 text-xs font-mono font-semibold px-2 py-0.5 rounded">.{f.ext.toLowerCase()}</span>
                  <span className="text-gray-400 text-xs ml-2">{f.mime}</span>
                </td>
                <td className="px-5 py-3">
                  {f.send
                    ? <span className="text-green-600 font-semibold text-xs">✓ Yes</span>
                    : <span className="text-gray-300 text-xs">—</span>}
                </td>
                <td className="px-5 py-3">
                  {f.receive
                    ? <span className="text-green-600 font-semibold text-xs">✓ Yes</span>
                    : <span className="text-gray-300 text-xs">—</span>}
                </td>
                <td className="px-5 py-3 text-gray-500 text-xs">{f.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Limits */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Limits & Settings</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {limits.map((l) => (
            <div key={l.label} className="px-5 py-3 flex justify-between items-center">
              <span className="text-sm text-gray-600">{l.label}</span>
              <span className="text-sm font-medium text-gray-900">{l.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
        <h2 className="text-sm font-semibold text-blue-900 mb-2">Tips for best results</h2>
        <ul className="text-xs text-blue-800 space-y-1.5 list-disc list-inside">
          <li>Use PDF when possible — it preserves formatting and supports multiple pages</li>
          <li>For image files, ensure the resolution is at least 200 DPI for readable output</li>
          <li>Avoid scanned PDFs with very low contrast — fax compression can make them illegible</li>
          <li>Use Fine resolution for medical documents, Standard for general correspondence</li>
        </ul>
      </div>
    </div>
  )
}
