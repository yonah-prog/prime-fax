"use client"

import { useEffect, useState } from "react"

interface Toast {
  id: number
  message: string
  type: "success" | "error" | "info"
}

let toastId = 0
const listeners: Set<(t: Toast) => void> = new Set()

export function showToast(message: string, type: Toast["type"] = "success") {
  const t = { id: ++toastId, message, type }
  listeners.forEach((fn) => fn(t))
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const handler = (t: Toast) => {
      setToasts((prev) => [...prev, t])
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 4000)
    }
    listeners.add(handler)
    return () => { listeners.delete(handler) }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white max-w-sm pointer-events-auto transition-all ${
            t.type === "success" ? "bg-green-600" :
            t.type === "error" ? "bg-red-600" : "bg-blue-600"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
