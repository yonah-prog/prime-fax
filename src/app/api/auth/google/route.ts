import { getAuthUrl, isGoogleConfigured } from "@/lib/google-drive"
import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import { originFromRequest } from "@/lib/request-origin"

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error
  if (!isGoogleConfigured()) return NextResponse.json({ error: "Google OAuth not configured" }, { status: 503 })
  return NextResponse.redirect(getAuthUrl(originFromRequest(req)))
}
