import { auth } from "@/auth"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { asc } from "drizzle-orm"
import UserManager from "@/components/user-manager"

export const dynamic = "force-dynamic"

export default async function UsersPage() {
  const session = await auth()
  const allUsers = await db.query.users.findMany({
    orderBy: [asc(users.createdAt)],
    columns: { passwordHash: false },
  })

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Add / Manage Users</h1>
      <UserManager initial={allUsers} currentUserId={session?.user?.id ?? ""} />
    </div>
  )
}
