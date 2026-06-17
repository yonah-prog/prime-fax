"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"

interface Props {
  page: number
  totalPages: number
}

export default function Pagination({ page, totalPages }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (totalPages <= 1) return null

  function go(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(p))
    router.push(`${pathname}?${params.toString()}`)
  }

  const pages: (number | "…")[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 2) pages.push(i)
    else if (pages[pages.length - 1] !== "…") pages.push("…")
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-5">
      <button
        onClick={() => go(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 text-sm rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
      >
        ‹ Prev
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="px-2 text-gray-400">…</span>
        ) : (
          <button
            key={p}
            onClick={() => go(p as number)}
            className={`w-9 h-9 text-sm rounded border ${
              p === page
                ? "bg-blue-600 text-white border-blue-600"
                : "border-gray-200 hover:bg-gray-50"
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => go(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1.5 text-sm rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
      >
        Next ›
      </button>
    </div>
  )
}
