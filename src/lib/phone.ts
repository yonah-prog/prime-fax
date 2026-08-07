/**
 * Normalize a user-entered fax/phone number to E.164 (e.g. "+17185551234").
 *
 * Telnyx rejects anything that isn't E.164 (or a SIP endpoint) with a 422
 * "'to' is invalid" error, so recipient numbers must be normalized before they
 * are sent. Returns null when the input can't be confidently normalized, so the
 * caller can surface a clear validation error instead of a raw Telnyx 422.
 *
 * Rules (US-centric, matching how staff type numbers):
 *  - Already-E.164 "+1..." / "+<country>..." is kept (digits re-derived).
 *  - 10 digits            -> +1XXXXXXXXXX  (assume US)
 *  - 11 digits led by 1   -> +1XXXXXXXXXX
 *  - "011" intl prefix    -> +<rest>
 *  - SIP endpoints (sip: or containing @) pass through unchanged.
 */
export function toE164(input: string | null | undefined): string | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null

  // SIP endpoints are valid Telnyx destinations — leave them alone.
  if (/^sip:/i.test(trimmed) || trimmed.includes("@")) return trimmed

  const digits = trimmed.replace(/\D/g, "")
  if (!digits) return null

  if (trimmed.startsWith("+")) {
    // Already international; require a plausible length.
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null
  }
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  if (digits.length > 11 && digits.startsWith("011")) {
    const rest = digits.slice(3)
    return rest.length >= 8 && rest.length <= 15 ? `+${rest}` : null
  }
  return null
}
