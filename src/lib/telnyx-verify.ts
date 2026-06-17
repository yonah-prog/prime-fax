import { createVerify } from "crypto"

/**
 * Verifies a Telnyx webhook signature (Ed25519).
 * Set TELNYX_WEBHOOK_PUBLIC_KEY in env with the base64 key from the Telnyx portal.
 */
export function verifyTelnyxWebhook(
  rawBody: string,
  signature: string | null,
  timestamp: string | null
): boolean {
  const publicKey = process.env.TELNYX_WEBHOOK_PUBLIC_KEY
  if (!publicKey || !signature || !timestamp) return !publicKey // skip if key not configured
  try {
    const message = `${timestamp}|${rawBody}`
    const verify = createVerify("Ed25519")
    verify.update(Buffer.from(message))
    const pem = `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`
    return verify.verify(pem, Buffer.from(signature, "base64"))
  } catch {
    return false
  }
}
