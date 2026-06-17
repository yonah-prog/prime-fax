const BASE = "https://api.humblefax.com"

export interface HFInboundFax {
  id: string
  status: string
  time: string
  toNumber: string
  fromNumber: string
  fromNameAddressBook: string
  fromNameIdentity: string
  numPages: string
  transmissionTime: string
  bitRate: string
}

export interface HFCall {
  status: string
  toNumber: string
  timeStart: string
  timeStop: string
  bitRate: string
  startPage: string
  pagesSent: string
  transmissionTime: number
  failureReason?: string
}

export interface HFAttempt {
  status: string
  numCalls: number
  numPagesSent: number
  calls: HFCall[]
}

export interface HFRecipient {
  numAttempts: number
  status: string
  toNumber: string | number
  attempts: HFAttempt[]
}

export interface HFSentFax {
  id: string
  status: string
  timestamp: string
  fromName: string
  fromNumber: string | number
  senderEmail: string
  uuid: string | false
  source: string
  resolution: string
  pageSize: string
  subject: string
  message: string
  numPages: string
  hasCoversheet: boolean
  numSuccesses: number
  numInProgress: number
  numFailures: number
  recipients: HFRecipient[]
}

export interface HFNumber {
  number: string | number
  tollFree: boolean
  departmentName: string | null
  callerId: string | null
  userIdsWithAccess: string[]
}

function authHeader(): string {
  const key = process.env.HUMBLEFAX_API_KEY!
  const secret = process.env.HUMBLEFAX_SECRET_KEY!
  return "Basic " + Buffer.from(`${key}:${secret}`).toString("base64")
}

async function hfGet(path: string): Promise<Record<string, unknown>> {
  const r = await fetch(`${BASE}${path}`, {
    headers: { Authorization: authHeader() },
    cache: "no-store",
  })
  const json = await r.json() as { result: string; error?: string; data: Record<string, unknown> }
  if (json.result !== "success") throw new Error(json.error ?? "HumbleFax API error")
  return json.data
}

export function e164(n: string | number): string {
  const s = String(n)
  return s.startsWith("+") ? s : `+${s}`
}

export function mapInboundStatus(s: string): "received" | "failed" {
  return s === "success" ? "received" : "failed"
}

export function mapOutboundStatus(s: string): "delivered" | "sending" | "failed" {
  if (s === "success") return "delivered"
  if (s === "in progress") return "sending"
  return "failed"
}

export async function hfGetIncomingFaxes(): Promise<HFInboundFax[]> {
  const data = await hfGet("/incomingFaxes")
  return (data.incomingFaxes as HFInboundFax[]) ?? []
}

export async function hfGetSentFaxIds(): Promise<string[]> {
  const data = await hfGet("/sentFaxes")
  return (data.sentFaxIds as string[]) ?? []
}

export async function hfGetSentFax(id: string): Promise<HFSentFax> {
  const data = await hfGet(`/sentFax/${id}`)
  return data.sentFax as HFSentFax
}

export async function hfGetNumbers(): Promise<HFNumber[]> {
  const data = await hfGet("/numbers")
  return (data.numbers as HFNumber[]) ?? []
}

export async function hfRegisterWebhook(url: string): Promise<unknown> {
  const r = await fetch(`${BASE}/webhook`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  })
  return await r.json()
}

export async function hfGetWebhooks(): Promise<unknown[]> {
  const data = await hfGet("/webhooks")
  return (data.webhooks as unknown[]) ?? []
}
