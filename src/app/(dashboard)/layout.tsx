import { auth } from "@/auth"
import { db } from "@/lib/db"
import { faxes } from "@/lib/db/schema"
import { and, count, eq, isNull } from "drizzle-orm"
import Sidebar from "@/components/sidebar"
import ToastContainer from "@/components/toast"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role ?? "staff"

  let unreadCount = 0
  try {
    const [unreadResult] = await db
      .select({ value: count() })
      .from(faxes)
      .where(and(eq(faxes.direction, "inbound"), isNull(faxes.readAt), isNull(faxes.trashedAt)))
    unreadCount = unreadResult?.value ?? 0
  } catch {
    // DB unavailable — unread badge shows 0
  }

  return (
    <div className="flex h-full">
      <Sidebar role={role} unreadCount={unreadCount} />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6 lg:p-8 pt-16 lg:pt-8">
        {children}
      </main>
      <ToastContainer />
    </div>
  )
}
