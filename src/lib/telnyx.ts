const TELNYX_API_BASE = "https://api.telnyx.com/v2"

function headers() {
  return {
    Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
    "Content-Type": "application/json",
  }
}

export interface SendFaxOptions {
  from: string
  to: string
  mediaUrl: string
  webhookUrl: string
}

export interface TelnyxFax {
  id: string
  status: string
  from: string
  to: string
  page_count: number | null
}

export async function sendFax(opts: SendFaxOptions): Promise<TelnyxFax> {
  const res = await fetch(`${TELNYX_API_BASE}/faxes`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      from: opts.from,
      to: opts.to,
      media_url: opts.mediaUrl,
      webhook_url: opts.webhookUrl,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Telnyx send failed: ${res.status} ${err}`)
  }

  const json = await res.json()
  return json.data as TelnyxFax
}

export async function getFax(faxId: string): Promise<TelnyxFax> {
  const res = await fetch(`${TELNYX_API_BASE}/faxes/${faxId}`, {
    headers: headers(),
  })

  if (!res.ok) throw new Error(`Telnyx get fax failed: ${res.status}`)
  const json = await res.json()
  return json.data as TelnyxFax
}

export interface AvailableNumber {
  phone_number: string
  region_information: { region_name: string; region_type: string }[]
  cost: { currency: string; amount: string } | null
}

export async function searchAvailableNumbers(areaCode: string, limit = 10): Promise<AvailableNumber[]> {
  const params = new URLSearchParams({
    "filter[phone_number][starts_with]": `+1${areaCode}`,
    "filter[features][]": "fax",
    "filter[limit]": String(limit),
  })
  const res = await fetch(`${TELNYX_API_BASE}/available_phone_numbers?${params}`, {
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Telnyx number search failed: ${res.status} ${err}`)
  }
  const json = await res.json()
  return (json.data ?? []) as AvailableNumber[]
}

export interface ProvisionedNumber {
  id: string
  phone_number: string
  status: string
}

export async function provisionNumber(phoneNumber: string): Promise<ProvisionedNumber> {
  const res = await fetch(`${TELNYX_API_BASE}/phone_numbers/orders`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ phone_numbers: [{ phone_number: phoneNumber }] }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Telnyx provision failed: ${res.status} ${err}`)
  }
  const json = await res.json()
  // Orders return an array; grab the first phone_number entry
  const record = json.data?.phone_numbers?.[0]
  return { id: record?.id ?? "", phone_number: record?.phone_number ?? phoneNumber, status: record?.status ?? "pending" }
}

export async function releaseNumber(telnyxNumberId: string): Promise<void> {
  const res = await fetch(`${TELNYX_API_BASE}/phone_numbers/${telnyxNumberId}`, {
    method: "DELETE",
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Telnyx release failed: ${res.status} ${err}`)
  }
}
