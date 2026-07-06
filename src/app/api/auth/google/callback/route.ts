import { auth } from "@/auth"
import { exchangeCode } from "@/lib/google-drive"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { originFromRequest } from "@/lib/request-origin"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // Google reports consent/redirect problems via an `error` param (e.g.
  // access_denied, redirect_uri_mismatch). Surface it rather than a generic msg.
  const googleError = req.nextUrl.searchParams.get("error")
  if (googleError) {
    console.error("Google OAuth returned error:", googleError)
    return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(googleError)}`, req.url))
  }

  const code = req.nextUrl.searchParams.get("code")
  if (!code) {
    return NextResponse.redirect(new URL("/settings?error=google_auth_failed", req.url))
  }

  try {
    const tokens = await exchangeCode(code, originFromRequest(req))
    await db.update(users).set({
      googleAccessToken: tokens.access_token ?? null,
      googleRefreshToken: tokens.refresh_token ?? null,
      googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    }).where(eq(users.id, session.user.id))
  } catch (e) {
    console.error("Google token exchange failed:", e)
    const msg = e instanceof Error ? e.message : "google_token_failed"
    return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(msg.slice(0, 140))}`, req.url))
  }

  return NextResponse.redirect(new URL("/settings?google=connected", req.url))
}
