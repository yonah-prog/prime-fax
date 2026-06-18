import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { groups, userGroups } from "@/lib/db/schema"
import { eq, asc, sql } from "drizzle-orm"
import GroupManager from "@/components/group-manager"

export const dynamic = "force-dynamic"

export default async function GroupsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      description: groups.description,
      createdAt: groups.createdAt,
      updatedAt: groups.updatedAt,
      memberCount: sql<number>`count(${userGroups.id})::int`,
    })
    .from(groups)
    .leftJoin(userGroups, eq(userGroups.groupId, groups.id))
    .groupBy(groups.id)
    .orderBy(asc(groups.name))

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Manage Groups</h1>
      <GroupManager initial={rows} />
    </div>
  )
}
