import type { NextRequest } from "next/server"

/**
 * Resolve the public origin (scheme + host) of an incoming request.
 *
 * Behind Railway's (and most PaaS) reverse proxy, req.url reflects the internal
 * host, while the browser-facing host/scheme arrive in the X-Forwarded-* headers.
 * We prefer those so OAuth redirect URIs match the domain the user is actually
 * on. Falls back to the Host header, then req.nextUrl.origin.
 */
export function originFromRequest(req: NextRequest): string {
  const fwdHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
  const fwdProto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim()
  if (fwdHost) {
    const proto = fwdProto || (fwdHost.startsWith("localhost") || fwdHost.startsWith("127.") ? "http" : "https")
    return `${proto}://${fwdHost}`
  }
  return req.nextUrl.origin
}
