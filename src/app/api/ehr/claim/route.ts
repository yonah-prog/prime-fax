import { NextResponse } from "next/server"
import { validateMedplumToken } from "@/lib/medplum-auth"

const STEDI_BASE = "https://healthcare.us.stedi.com/2024-04-01"

export async function POST(req: Request) {
  if (!await validateMedplumToken(req.headers.get("authorization") ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json() as {
    claimId: string
    patient: { name: string; dob: string; memberId: string }
    provider: { npi: string; name: string; taxId: string }
    payer: { payerId: string; name: string }
    dateOfService: string
    placeOfService: string
    diagnoses: string[]
    lines: Array<{
      cpt: string
      description: string
      units: number
      fee: number
      modifier?: string
      modifiers?: string[]
      icd10s: string[]
      ndc?: string
    }>
    totalCharge: number
    authNumber?: string
    referringNpi?: string
    renderingNpi?: string
    renderingName?: string
    filingCode?: string
  }

  // ICD-10 code → 1-indexed pointer letter (A, B, C…) for serviceLine.diagnosis.
  const dxPointerFor = (icd: string): string => {
    const idx = body.diagnoses.findIndex((d) => d.replace('.', '') === icd.replace('.', ''))
    return idx >= 0 ? String.fromCharCode(65 + idx) : 'A'
  }

  const controlNumber = (Math.floor(100000000 + Math.random() * 900000000)).toString()

  const stediPayload = {
    controlNumber,
    tradingPartnerServiceId: body.payer.payerId,
    provider: {
      organizationName: process.env.BILLING_GROUP_NAME ?? body.provider.name,
      npi: process.env.BILLING_GROUP_NPI ?? body.provider.npi,
      taxId: process.env.BILLING_TAX_ID ?? body.provider.taxId,
    },
    subscriber: {
      memberId: body.patient.memberId,
      dateOfBirth: body.patient.dob,
      name: body.patient.name,
    },
    claimInformation: {
      claimFilingCode: body.filingCode ?? 'CI',
      patientControlNumber: body.claimId,
      claimChargeAmount: body.totalCharge.toFixed(2),
      placeOfServiceCode: body.placeOfService.split(" ")[0] || "11",
      claimFrequencyCode: "1",
      signatureIndicator: "Y",
      planParticipationCode: "A",
      serviceLines: body.lines.map((l, i) => {
        // Prefer the explicit modifiers array; fall back to the legacy single.
        const mods = (l.modifiers && l.modifiers.length ? l.modifiers : (l.modifier ? [l.modifier] : []))
          .filter(Boolean)
          .slice(0, 4)
        // CMS-1500 Box 24E: pointer letters, not raw codes.
        const pointers = (l.icd10s ?? []).map(dxPointerFor)
        return {
          serviceLineNumber: String(i + 1),
          procedureCode: l.cpt,
          ...(mods.length ? { procedureModifiers: mods } : {}),
          ...(pointers.length ? { compositeDiagnosisCodePointers: { diagnosisCodePointers: pointers } } : {}),
          lineItemChargeAmount: (l.fee * l.units).toFixed(2),
          serviceUnitCount: String(l.units),
          serviceDate: body.dateOfService,
          // Drug lines (J-codes) carry an NDC for pricing/rebate.
          ...(l.ndc ? {
            drugIdentification: {
              serviceIdQualifier: "N4",
              nationalDrugCode: l.ndc.replace(/\D/g, ''),
              nationalDrugUnitCount: String(l.units),
              measurementUnitCode: "UN",
            },
          } : {}),
        }
      }),
      healthCareCodeInformation: body.diagnoses.map((c, i) => ({
        diagnosisTypeCode: i === 0 ? "ABK" : "ABF",
        diagnosisCode: c.replace(".", ""),
      })),
    },
    ...(body.authNumber ? { referralNumber: body.authNumber } : {}),
    ...(body.referringNpi ? { referringProvider: { npi: body.referringNpi } } : {}),
    ...(body.renderingNpi ? { renderingProvider: { npi: body.renderingNpi, organizationName: body.renderingName ?? '' } } : {}),
  }

  const stediRes = await fetch(`${STEDI_BASE}/change/medicalclaims/v3/claims`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${process.env.STEDI_API_KEY}`,
    },
    body: JSON.stringify(stediPayload),
  })

  if (!stediRes.ok) {
    const errText = await stediRes.text()
    console.error('[STEDI claim error]', stediRes.status, errText)
    return NextResponse.json(
      { error: "Claim submission failed. Please try again." },
      { status: 502 }
    )
  }

  const data = await stediRes.json() as {
    claimReference?: { claimId: string }
    submittedAt?: string
  }

  return NextResponse.json({
    trackingId: data.claimReference?.claimId ?? body.claimId,
    status: "accepted",
    submittedAt: data.submittedAt ?? new Date().toISOString(),
  })
}
