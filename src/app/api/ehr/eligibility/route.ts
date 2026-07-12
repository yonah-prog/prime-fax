import { NextResponse } from "next/server"
import { validateMedplumToken } from "@/lib/medplum-auth"

const STEDI_BASE = "https://healthcare.us.stedi.com/2024-04-01"

export async function POST(req: Request) {
  if (!await validateMedplumToken(req.headers.get("authorization") ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json() as {
    tradingPartnerId: string
    memberId: string
    firstName: string
    lastName: string
    dateOfBirth: string
    dateOfService: string
    npi: string
    renderingNpi?: string
    serviceTypeCodes?: string[]
  }

  const providerNpi = body.renderingNpi ?? body.npi

  const stediRes = await fetch(`${STEDI_BASE}/change/medicalnetwork/eligibility/v3`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${process.env.STEDI_API_KEY}`,
    },
    body: JSON.stringify({
      controlNumber: (Math.floor(100000000 + Math.random() * 900000000)).toString(),
      tradingPartnerServiceId: body.tradingPartnerId,
      provider: {
        organizationName: "Premier Health",
        npi: providerNpi,
        serviceProviderNumber: providerNpi,
      },
      subscriber: {
        memberId: body.memberId,
        firstName: body.firstName,
        lastName: body.lastName,
        dateOfBirth: body.dateOfBirth,
      },
      encounter: {
        serviceTypeCodes: body.serviceTypeCodes ?? ["30"],
        dateOfService: body.dateOfService,
      },
    }),
  })

  if (!stediRes.ok) {
    const errText = await stediRes.text()
    console.error('[STEDI eligibility error]', stediRes.status, errText)
    return NextResponse.json({
      active: false,
      benefits: [],
      notes: 'Eligibility check unavailable. Please try again or contact support.',
    })
  }

  const data = await stediRes.json() as Record<string, unknown>
  const subscriber = (data.subscriber as Record<string, unknown>) ?? {}
  const benefits = ((data.benefitsInformation as unknown[]) ?? []) as Record<string, unknown>[]

  const parsedBenefits = benefits.slice(0, 50).flatMap((b): Array<{ category: string; detail: string; amount?: number }> => {
    const serviceTypes = ((b.serviceTypeCodes as string[]) ?? []).join(", ")
    const benefitAmounts = ((b.benefitAmount as string[]) ?? [])
    const name = (b.name as string) ?? serviceTypes
    if (!name) return []
    if (benefitAmounts.length > 0) {
      return benefitAmounts.map((amt: string) => ({
        category: name,
        detail: `$${parseFloat(amt).toFixed(2)}`,
        amount: parseFloat(amt),
      }))
    }
    const pct = b.benefitPercent as string | undefined
    return [{
      category: name,
      detail: pct ? `${pct}%` : ((b.insuranceTypeCode as string) ?? "See plan documents"),
      amount: undefined,
    }]
  }).filter((b) => b.category)

  return NextResponse.json({
    active: true,
    planName: (subscriber.planDescription as string)
      ?? (subscriber.groupDescription as string)
      ?? "Unknown Plan",
    groupNumber: (subscriber.groupOrPolicyNumber as string) ?? "",
    benefits: parsedBenefits.length > 0
      ? parsedBenefits
      : [{ category: "Coverage active", detail: "Contact payer for benefit details" }],
    notes: `Verified via STEDI 270/271. Member: ${body.memberId}`,
  })
}
