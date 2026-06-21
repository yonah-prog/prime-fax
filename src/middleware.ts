import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth({ ...authConfig, trustHost: true })

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl
  const isLoginPage = pathname === "/login"

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/send", req.url))
  }

  const adminRoutes = ["/admin", "/numbers"]
  const isAdminRoute = adminRoutes.some((r) => pathname.startsWith(r))
  if (isLoggedIn && isAdminRoute) {
    const role = (req.auth as { user?: { role?: string } })?.user?.role
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/send", req.url))
    }
  }
})

export const config = {
  // Exclude auth/webhook/health APIs, Next internals, and static asset files
  // (by extension) so public assets like cover-sheet .trdx/.pdf and the logo
  // aren't redirected to /login.
  matcher: [
    "/((?!api/auth|api/webhooks|api/health|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|ico|webp|woff2?|trdx|pdf|xml|txt)$).*)",
  ],
}
