import { timingSafeEqual } from "crypto"
import { validateMedplumToken } from "@/lib/medplum-auth"

// Server-to-server auth for the referral intake module. Intake presents
// `Authorization: Bearer <INTAKE_SERVICE_TOKEN>`; the comparison is constant-time.
// With the env var unset, no token is accepted.
export function validateServiceToken(authHeader: string | null | undefined): boolean {
  const want = Buffer.from(process.env.INTAKE_SERVICE_TOKEN ?? "")
  if (!want.length) return false
  const given = Buffer.from((authHeader ?? "").replace(/^Bearer\s+/i, "").trim())
  return given.length === want.length && timingSafeEqual(given, want)
}

export type Caller = "service" | "medplum"

// The EHR gateways accept either the intake service token or a logged-in
// Medplum user's token. The service token is checked first: it is local and
// cheap, while the Medplum check is a network call.
export async function validateServiceOrMedplum(req: Request): Promise<Caller | null> {
  const header = req.headers.get("authorization") ?? ""
  if (validateServiceToken(header)) return "service"
  if (await validateMedplumToken(header)) return "medplum"
  return null
}
