import { auth } from "@/auth"
import { getAuthUrl, isGoogleConfigured } from "@/lib/google-drive"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isGoogleConfigured()) return NextResponse.json({ error: "Google OAuth not configured" }, { status: 503 })
  return NextResponse.redirect(getAuthUrl())
}
