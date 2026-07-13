import { NextResponse } from "next/server"
import { validateMedplumToken } from "@/lib/medplum-auth"

const STEDI_BASE = "https://healthcare.us.stedi.com/2024-04-01"

// 276/277 real-time claim status inquiry. Sends a 276 to the payer through the
// clearinghouse and normalizes the 277 response into a friendly status.
export async function POST(req: Request) {
  if (!await validateMedplumToken(req.headers.get("authorization") ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json() as {
    tradingPartnerId: string
    npi: string
    organizationName?: string
    taxId?: string
    memberId: string
    firstName: string
    lastName: string
    dateOfBirth: string        // YYYYMMDD
    dateOfService: string      // YYYYMMDD
    trackingNumber?: string    // patient control number / claim id
    chargeAmount?: string
  }

  const stediPayload = {
    controlNumber: (Math.floor(100000000 + Math.random() * 900000000)).toString(),
    tradingPartnerServiceId: body.tradingPartnerId,
    providers: [{
      organizationName: process.env.BILLING_GROUP_NAME ?? body.organizationName ?? "Premier Health",
      npi: process.env.BILLING_GROUP_NPI ?? body.npi,
      serviceProviderNumber: body.npi,
      providerType: "BillingProvider",
      taxId: process.env.BILLING_TAX_ID ?? body.taxId,
    }],
    subscriber: {
      memberId: body.memberId,
      firstName: body.firstName,
      lastName: body.lastName,
      dateOfBirth: body.dateOfBirth,
    },
    encounter: {
      beginningDateOfService: body.dateOfService,
      endDateOfService: body.dateOfService,
      ...(body.trackingNumber ? { trackingNumber: body.trackingNumber } : {}),
      ...(body.chargeAmount ? { submittedAmount: body.chargeAmount } : {}),
    },
  }

  const stediRes = await fetch(`${STEDI_BASE}/change/medicalnetwork/claimstatus/v2`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${process.env.STEDI_API_KEY}`,
    },
    body: JSON.stringify(stediPayload),
  })

  if (!stediRes.ok) {
    const errText = await stediRes.text()
    console.error("[STEDI claim-status error]", stediRes.status, errText)
    return NextResponse.json(
      { error: "Claim status inquiry unavailable. Please try again." },
      { status: 502 },
    )
  }

  const data = await stediRes.json() as Record<string, unknown>

  // The 277 nests status differently across payers; deep-search for the first
  // status category/code and the finalized amounts rather than assume a shape.
  const found = deepFindStatus(data)
  const amount = (k: string): number | undefined => {
    const v = deepFindKey(data, k)
    const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN
    return Number.isFinite(n) ? n : undefined
  }

  return NextResponse.json({
    found: !!found,
    categoryCode: found?.statusCategoryCode,
    category: found?.statusCategoryCodeValue,
    statusCode: found?.statusCode,
    status: found?.statusCodeValue,
    totalCharge: amount("totalClaimChargeAmount"),
    paidAmount: amount("claimPaymentAmount") ?? amount("monetaryAmount"),
    checkNumber: deepFindKey(data, "checkNumber") as string | undefined,
    effectiveDate: (deepFindKey(data, "statusInformationEffectiveDate")
      ?? deepFindKey(data, "effectiveDate")) as string | undefined,
    tradingPartnerServiceId: body.tradingPartnerId,
  })
}

interface StatusHit {
  statusCategoryCode?: string
  statusCategoryCodeValue?: string
  statusCode?: string
  statusCodeValue?: string
}

// Depth-first search for the first object carrying a claim status category.
function deepFindStatus(obj: unknown): StatusHit | undefined {
  if (!obj || typeof obj !== "object") return undefined
  const rec = obj as Record<string, unknown>
  if (rec.statusCategoryCode || rec.statusCategoryCodeValue) {
    return {
      statusCategoryCode: rec.statusCategoryCode as string | undefined,
      statusCategoryCodeValue: rec.statusCategoryCodeValue as string | undefined,
      statusCode: rec.statusCode as string | undefined,
      statusCodeValue: rec.statusCodeValue as string | undefined,
    }
  }
  for (const v of Object.values(rec)) {
    if (Array.isArray(v)) {
      for (const item of v) {
        const hit = deepFindStatus(item)
        if (hit) return hit
      }
    } else if (v && typeof v === "object") {
      const hit = deepFindStatus(v)
      if (hit) return hit
    }
  }
  return undefined
}

function deepFindKey(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== "object") return undefined
  const rec = obj as Record<string, unknown>
  if (key in rec && rec[key] != null) return rec[key]
  for (const v of Object.values(rec)) {
    if (Array.isArray(v)) {
      for (const item of v) {
        const hit = deepFindKey(item, key)
        if (hit != null) return hit
      }
    } else if (v && typeof v === "object") {
      const hit = deepFindKey(v, key)
      if (hit != null) return hit
    }
  }
  return undefined
}
