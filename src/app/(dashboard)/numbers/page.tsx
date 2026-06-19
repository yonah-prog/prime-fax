import NumberManager from "@/components/number-manager"
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function NumbersPage() {
  const session = await auth()
  if (!session || (session.user as { role?: string })?.role !== "admin") redirect("/sent")

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Numbers & Caller ID</h1>
      <NumberManager />
    </div>
  )
}
