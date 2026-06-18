import { auth } from "@/auth"
import { db } from "@/lib/db"
import { users, phoneNumbers } from "@/lib/db/schema"
import { desc, asc } from "drizzle-orm"
import UserManager from "@/components/user-manager"

export const dynamic = "force-dynamic"

export default async function UsersPage() {
  const session = await auth()
  const allUsers = await db.query.users.findMany({
    orderBy: [asc(users.createdAt)],
    columns: { passwordHash: false },
  })
  const allNumbers = await db.query.phoneNumbers.findMany({
    where: (t, { eq }) => eq(t.active, true),
    orderBy: [desc(phoneNumbers.isDefault), asc(phoneNumbers.createdAt)],
  })

  return (
    <div className="max-w-6xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Add / Manage Users</h1>
      <UserManager
        initial={allUsers}
        currentUserId={session?.user?.id ?? ""}
        numbers={allNumbers.map((n) => ({
          id: n.id,
          number: n.number,
          label: n.label,
          isDefault: n.isDefault,
        }))}
      />
    </div>
  )
}
