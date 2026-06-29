import type { Session } from "next-auth"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { users, phoneNumbers, userPhoneNumbers } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export interface FaxAccess {
  isAdmin: boolean
  userId: string | null
  email: string | null
  canViewInbound: boolean
  canViewAllSent: boolean
  canDelete: boolean
  /** Phone-number strings this user may see inbound faxes for. */
  numbers: string[]
}

/**
 * Resolves the current user's fax-visibility permissions. Admins see and can do
 * everything. For staff, inbound visibility is scoped to the numbers they're
 * assigned/granted, and sent visibility is all-or-own based on canViewAllSent.
 */
export async function getFaxAccess(): Promise<FaxAccess> {
  const session = (await auth()) as Session | null
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null
  const email = session?.user?.email ?? null
  const role = (session?.user as { role?: string } | undefined)?.role

  if (!userId) {
    return { isAdmin: false, userId: null, email: null, canViewInbound: false, canViewAllSent: false, canDelete: false, numbers: [] }
  }
  if (role === "admin") {
    return { isAdmin: true, userId, email, canViewInbound: true, canViewAllSent: true, canDelete: true, numbers: [] }
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })

  const grants = await db
    .select({ number: phoneNumbers.number })
    .from(userPhoneNumbers)
    .innerJoin(phoneNumbers, eq(userPhoneNumbers.phoneNumberId, phoneNumbers.id))
    .where(eq(userPhoneNumbers.userId, userId))

  const numbers = new Set(grants.map((g) => g.number))
  if (user?.assignedNumberId) {
    const assigned = await db.query.phoneNumbers.findFirst({
      where: eq(phoneNumbers.id, user.assignedNumberId),
      columns: { number: true },
    })
    if (assigned?.number) numbers.add(assigned.number)
  }

  return {
    isAdmin: false,
    userId,
    email,
    canViewInbound: !!user?.canViewInbound,
    canViewAllSent: !!user?.canViewAllSent,
    canDelete: !!user?.canDelete,
    numbers: [...numbers],
  }
}

/** Whether a specific fax is visible to the given access context. */
export function canSeeFax(
  access: FaxAccess,
  fax: { direction: "inbound" | "outbound"; toNumber: string; userId: string | null }
): boolean {
  if (access.isAdmin) return true
  if (fax.direction === "inbound") {
    return access.canViewInbound && access.numbers.includes(fax.toNumber)
  }
  return access.canViewAllSent || fax.userId === access.userId
}
