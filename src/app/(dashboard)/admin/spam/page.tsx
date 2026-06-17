import { db } from "@/lib/db"
import { blockedNumbers } from "@/lib/db/schema"
import { desc } from "drizzle-orm"
import SpamManager from "@/components/spam-manager"

export const dynamic = "force-dynamic"

export default async function SpamPage() {
  const rows = await db.query.blockedNumbers.findMany({
    orderBy: [desc(blockedNumbers.createdAt)],
  })

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Spam Filter</h1>
      <SpamManager initial={rows} />
    </div>
  )
}
