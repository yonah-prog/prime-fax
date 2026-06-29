import { getAuthUrl, isGoogleConfigured } from "@/lib/google-drive"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error
  if (!isGoogleConfigured()) return NextResponse.json({ error: "Google OAuth not configured" }, { status: 503 })
  return NextResponse.redirect(getAuthUrl())
}
