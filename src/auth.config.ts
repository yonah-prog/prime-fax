import type { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"

// Lightweight config for middleware — NO db import (edge-runtime safe)
export const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // authorize is not called in middleware (only in auth.ts)
      async authorize() { return null },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role ?? "staff"
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      ;(session.user as unknown as Record<string, unknown>).role = token.role as string
      return session
    },
  },
}
