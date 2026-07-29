import { NextResponse } from "next/server"
import { validateMedplumToken } from "@/lib/medplum-auth"

const STEDI_BASE = "https://healthcare.us.stedi.com/2024-04-01"

// KNOWN BROKEN: the path below returns 404 NOT_FOUND from Stedi — it does not
// exist on the 2024-04-01 API. Eligibility (medicalnetwork/eligibility/v3),
// claim status (medicalnetwork/claimstatus/v2) and professional claim
// submission (medicalnetwork/professionalclaims/v3/submission) all resolve
// correctly, so this is specific to remittance retrieval.
// Stedi delivers 835s via a Files/SFTP-style feed rather than a polled REST
// endpoint, so this needs rewriting against that API rather than a URL tweak.
// Until then every call fails and the route returns 503 rather than an empty
// list, so denials are never silently reported as "none".
const REMITTANCES_PATH = "change/medicalclaims/v3/remittances"

export async function GET(req: Request) {
  if (!await validateMedplumToken(req.headers.get("authorization") ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const rawStatus = searchParams.get("status") ?? "denied"
  const count = searchParams.get("_count") ?? "50"

  const VALID_STATUSES = ['denied', 'approved', 'pending', 'all']
  const validStatus = VALID_STATUSES.includes(rawStatus) ? rawStatus : 'denied'
  const cappedCount = Math.min(200, Math.max(1, parseInt(count, 10) || 50))

  const stediRes = await fetch(
    `${STEDI_BASE}/${REMITTANCES_PATH}?status=${encodeURIComponent(validStatus)}&_count=${cappedCount}`,
    { headers: { Authorization: `Key ${process.env.STEDI_API_KEY}` } }
  )

  if (!stediRes.ok) {
    const errText = await stediRes.text().catch(() => '')
    console.error('[STEDI remittances error]', stediRes.status, errText)
    // An empty list here reads as "nothing to work" — a biller would move on
    // and never chase real denials. Fail loudly instead.
    return NextResponse.json(
      {
        status: 'unavailable',
        remittances: [],
        notes: 'Remittances could not be retrieved — the clearinghouse did not respond. This is not a statement that no remittances exist.',
      },
      { status: 503 }
    )
  }

  const data = await stediRes.json() as { remittances?: unknown[] }
  return NextResponse.json({ remittances: data.remittances ?? [] })
}
