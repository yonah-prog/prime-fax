import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

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
  matcher: ["/((?!api/auth|api/webhooks|_next/static|_next/image|favicon.ico).*)"],
}
