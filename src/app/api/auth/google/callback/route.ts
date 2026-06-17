import { auth } from "@/auth"
import { exchangeCode } from "@/lib/google-drive"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  const code = req.nextUrl.searchParams.get("code")
  if (!code) {
    return NextResponse.redirect(new URL("/settings?error=google_auth_failed", req.url))
  }

  try {
    const tokens = await exchangeCode(code)
    await db.update(users).set({
      googleAccessToken: tokens.access_token ?? null,
      googleRefreshToken: tokens.refresh_token ?? null,
      googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    }).where(eq(users.id, session.user.id))
  } catch {
    return NextResponse.redirect(new URL("/settings?error=google_token_failed", req.url))
  }

  return NextResponse.redirect(new URL("/settings?google=connected", req.url))
}
