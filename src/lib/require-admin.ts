import { auth } from "@/auth"
import { NextResponse } from "next/server"

export async function requireAdmin(): Promise<{ session: Awaited<ReturnType<typeof auth>>; error: NextResponse | null }> {
  const session = await auth()
  if (!session) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  if ((session.user as { role?: string })?.role !== "admin") {
    return { session, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { session, error: null }
}
