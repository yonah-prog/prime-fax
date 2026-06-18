import { auth } from "@/auth"
import { db } from "@/lib/db"
import { faxes, phoneNumbers, users } from "@/lib/db/schema"
import { and, count, eq, isNull } from "drizzle-orm"
import Sidebar from "@/components/sidebar"
import ToastContainer from "@/components/toast"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role ?? "staff"
  const userId = (session?.user as { id?: string })?.id
  const userName = session?.user?.name ?? session?.user?.email ?? "User"

  let unreadCount = 0
  let userFaxNumber: string | null = null
  let userDept: string | null = null

  try {
    const [unreadResult] = await db
      .select({ value: count() })
      .from(faxes)
      .where(and(eq(faxes.direction, "inbound"), isNull(faxes.readAt), isNull(faxes.trashedAt)))
    unreadCount = unreadResult?.value ?? 0

    if (userId) {
      const [userRow] = await db
        .select({ assignedNumberId: users.assignedNumberId })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      if (userRow?.assignedNumberId) {
        const [numRow] = await db
          .select({ number: phoneNumbers.number, label: phoneNumbers.label, deptName: phoneNumbers.deptName })
          .from(phoneNumbers)
          .where(eq(phoneNumbers.id, userRow.assignedNumberId))
          .limit(1)
        if (numRow) {
          userFaxNumber = numRow.number
          userDept = numRow.deptName || numRow.label
        }
      }
    }
  } catch {
    // DB unavailable
  }

  return (
    <div className="flex h-full">
      <Sidebar role={role} unreadCount={unreadCount} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top info bar */}
        <header className="hidden lg:flex items-center justify-end gap-3 px-6 py-2 bg-white border-b border-gray-100 shrink-0">
          <button className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          </button>
          <div className="h-4 w-px bg-gray-200" />
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-gray-700">{userName}</span>
            {userFaxNumber && (
              <>
                <span className="text-gray-300">·</span>
                <span className="font-mono text-gray-500 text-xs">{userFaxNumber}</span>
              </>
            )}
            {userDept && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-gray-500 text-xs">{userDept}</span>
              </>
            )}
          </div>
          <div className="h-4 w-px bg-gray-200" />
          <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full font-medium">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            HIPAA Compliant
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-gray-50 p-6 lg:p-8 pt-16 lg:pt-6">
          {children}
        </main>
      </div>
      <ToastContainer />
    </div>
  )
}
