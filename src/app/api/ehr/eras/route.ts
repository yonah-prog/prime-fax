import { NextResponse } from "next/server"
import { validateMedplumToken } from "@/lib/medplum-auth"

// Retrieving 835 ERAs from Stedi is a two-step flow, not a single query:
//   1. Poll Transactions (core.us.stedi.com) for processed transactions.
//   2. For each 835, fetch its report from the healthcare Reports API.
// The previous implementation called change/medicalclaims/v3/remittances,
// which returns 404 NOT_FOUND — that path does not exist on this API.
const POLLING_URL = "https://core.us.stedi.com/2023-08-01/polling/transactions"
const REPORTS_BASE = "https://healthcare.us.stedi.com/2024-04-01/change/medicalnetwork/reports/v2"

const KEY = () => `Key ${process.env.STEDI_API_KEY}`

interface PolledTransaction {
  transactionId?: string
  id?: string
  transactionSetIdentifier?: string
  functionalIdentifierCode?: string
  processedAt?: string
}

interface EraDenial {
  claimNo: string
  patient: string
  payer: string
  dos: string
  cpt: string
  billed: number
  paid: number
  carcCode: string
  rarcCode?: string
  groupCode: "CO" | "PR" | "OA" | "PI"
  receivedAt: string
}

const isEra = (t: PolledTransaction): boolean =>
  t.transactionSetIdentifier === "835" || t.functionalIdentifierCode === "HP"

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""))
  return Number.isFinite(n) ? n : 0
}

/** Walk the polling feed (paginated) and collect 835 transaction ids. */
async function pollEraTransactionIds(sinceIso: string, cap: number): Promise<PolledTransaction[]> {
  const found: PolledTransaction[] = []
  let pageToken: string | undefined
  for (let page = 0; page < 20 && found.length < cap; page++) {
    // Stedi rejects both together: startDateTime opens the feed, pageToken
    // continues it.
    const url = new URL(POLLING_URL)
    if (pageToken) url.searchParams.set("pageToken", pageToken)
    else url.searchParams.set("startDateTime", sinceIso)
    const res = await fetch(url, { headers: { Authorization: KEY() } })
    if (!res.ok) throw new Error(`polling ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const body = (await res.json()) as { items?: PolledTransaction[]; nextPageToken?: string }
    found.push(...(body.items ?? []).filter(isEra))
    pageToken = body.nextPageToken
    if (!pageToken) break
  }
  return found.slice(0, cap)
}

/**
 * Flatten one 835 report into per-service-line rows. Stedi's 835 nests
 * payer → claim → service line, and each level can carry adjustments; a denial
 * is meaningful at the line it applies to, so rows are emitted per line.
 */
function flattenEra(report: Record<string, unknown>, receivedAt: string): EraDenial[] {
  const rows: EraDenial[] = []
  const payerName =
    ((report.payer as Record<string, unknown>)?.name as string) ??
    ((report.payerIdentification as Record<string, unknown>)?.name as string) ??
    "Unknown payer"

  const claims = [
    ...(((report.claims as unknown[]) ?? []) as Record<string, unknown>[]),
    ...(((report.claimPaymentInfo as unknown[]) ?? []) as Record<string, unknown>[]),
  ]

  for (const claim of claims) {
    const claimNo =
      (claim.claimNumber as string) ??
      (claim.patientControlNumber as string) ??
      (claim.claimId as string) ??
      "—"
    const patientParts = [
      (claim.patientLastName as string) ?? "",
      (claim.patientFirstName as string) ?? "",
    ].filter(Boolean)
    const patient =
      ((claim.patient as Record<string, unknown>)?.name as string) ??
      (patientParts.length > 0 ? patientParts.join(", ") : "—")
    const claimBilled = num(claim.totalClaimChargeAmount ?? claim.billedAmount)
    const claimPaid = num(claim.claimPaymentAmount ?? claim.paidAmount)

    const lines = ((claim.serviceLines as unknown[]) ?? []) as Record<string, unknown>[]
    const emit = (
      cpt: string,
      billed: number,
      paid: number,
      dos: string,
      adjustments: Record<string, unknown>[]
    ): void => {
      // One row per adjustment so each CARC is workable; if there are none the
      // line still appears, which matters for zero-pay claims.
      if (adjustments.length === 0) {
        rows.push({ claimNo, patient, payer: payerName, dos, cpt, billed, paid, carcCode: "", groupCode: "CO", receivedAt })
        return
      }
      for (const adj of adjustments) {
        const group = String(adj.adjustmentGroupCode ?? adj.groupCode ?? "CO").toUpperCase()
        rows.push({
          claimNo, patient, payer: payerName, dos, cpt, billed, paid,
          carcCode: String(adj.adjustmentReasonCode ?? adj.reasonCode ?? ""),
          rarcCode: (adj.remarkCodes as string[] | undefined)?.[0],
          groupCode: (["CO", "PR", "OA", "PI"].includes(group) ? group : "CO") as EraDenial["groupCode"],
          receivedAt,
        })
      }
    }

    if (lines.length === 0) {
      emit("—", claimBilled, claimPaid, (claim.serviceDate as string) ?? "", ((claim.claimAdjustments as unknown[]) ?? []) as Record<string, unknown>[])
      continue
    }
    for (const line of lines) {
      emit(
        ((line.serviceIdQualifier as Record<string, unknown>)?.procedureCode as string) ??
          (line.procedureCode as string) ?? "—",
        num(line.lineItemChargeAmount ?? line.billedAmount),
        num(line.lineItemProviderPaymentAmount ?? line.paidAmount),
        (line.serviceDate as string) ?? (claim.serviceDate as string) ?? "",
        ((line.serviceAdjustments as unknown[]) ?? []) as Record<string, unknown>[]
      )
    }
  }
  return rows
}

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  if (!(await validateMedplumToken(req.headers.get("authorization") ?? ""))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!process.env.STEDI_API_KEY) {
    return NextResponse.json(
      { status: "unavailable", remittances: [], notes: "Clearinghouse is not configured (STEDI_API_KEY missing)." },
      { status: 503 }
    )
  }

  const { searchParams } = new URL(req.url)
  const rawStatus = searchParams.get("status") ?? "denied"
  const validStatus = ["denied", "approved", "pending", "all"].includes(rawStatus) ? rawStatus : "denied"
  const cappedCount = Math.min(200, Math.max(1, parseInt(searchParams.get("_count") ?? "50", 10) || 50))
  const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") ?? "90", 10) || 90))
  const sinceIso = new Date(Date.now() - days * 86400000).toISOString()

  try {
    const eraTxns = await pollEraTransactionIds(sinceIso, cappedCount)

    const reports = await Promise.all(
      eraTxns.map(async (t) => {
        const id = t.transactionId ?? t.id
        if (!id) return []
        const res = await fetch(`${REPORTS_BASE}/${id}/835`, { headers: { Authorization: KEY() } })
        if (!res.ok) {
          console.error("[STEDI 835 report]", id, res.status, (await res.text()).slice(0, 200))
          return []
        }
        return flattenEra((await res.json()) as Record<string, unknown>, t.processedAt ?? new Date().toISOString())
      })
    )

    let remittances = reports.flat()
    // "denied" means the payer adjusted the line down — a contractual write-off
    // or a zero payment with a reason code.
    if (validStatus === "denied") remittances = remittances.filter((r) => r.carcCode !== "" && r.paid < r.billed)
    else if (validStatus === "approved") remittances = remittances.filter((r) => r.paid > 0)

    return NextResponse.json({ status: "ok", remittances: remittances.slice(0, cappedCount) })
  } catch (err) {
    console.error("[STEDI eras]", err)
    // Never return an empty list on failure — a biller would read that as
    // "no denials to work" and close out the day.
    return NextResponse.json(
      {
        status: "unavailable",
        remittances: [],
        notes: "Remittances could not be retrieved — the clearinghouse did not respond. This is not a statement that no remittances exist.",
      },
      { status: 503 }
    )
  }
}
