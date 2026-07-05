import { NextResponse } from "next/server"
import { validateMedplumToken } from "@/lib/medplum-auth"

const STEDI_BASE = "https://healthcare.us.stedi.com/2024-04-01"

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
    `${STEDI_BASE}/change/medicalclaims/v3/remittances?status=${encodeURIComponent(validStatus)}&_count=${cappedCount}`,
    { headers: { Authorization: `Key ${process.env.STEDI_API_KEY}` } }
  )

  if (!stediRes.ok) {
    return NextResponse.json({ remittances: [] })
  }

  const data = await stediRes.json() as { remittances?: unknown[] }
  return NextResponse.json({ remittances: data.remittances ?? [] })
}
