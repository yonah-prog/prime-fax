// Announces faxes to the referral intake module (caretend-clinical-assessment,
// /api/v1/intake-hooks). No PHI travels in these bodies: intake fetches the PDF
// itself from /api/intake/faxes/[id]/file with the service token.
//
// Nothing is sent unless INTAKE_HOOK_URL and INTAKE_HOOK_SECRET are both set.

export type FaxReceivedEvent = {
  faxId: string
  from: string
  to: string
  lineLabel: string | null
  pages: number | null
  receivedAt: string
}

export type FaxStatusEvent = {
  faxId: string
  referenceId: string
  status: "delivered" | "failed"
  error: string | null
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>

export type PostOptions = {
  fetchImpl?: FetchLike
  retries?: number
  // Delay before retry n (1-based). Tests pass () => 0.
  backoffMs?: (attempt: number) => number
}

const defaultBackoff = (attempt: number) => 500 * 2 ** (attempt - 1) // 0.5s, 1s, 2s

export function intakeConfigured(): boolean {
  return !!(process.env.INTAKE_HOOK_URL?.trim() && process.env.INTAKE_HOOK_SECRET)
}

// An inbound fax is announced only once it is stored (a new row, not a duplicate
// webhook), has a file, and arrived on a line that opted in.
export function shouldNotifyIntake(args: {
  inserted: boolean
  hasFile: boolean
  line: { intakeEnabled: boolean } | null | undefined
}): boolean {
  return args.inserted && args.hasFile && !!args.line?.intakeEnabled && intakeConfigured()
}

// POST with a few retries on network errors and 5xx/429. A 4xx other than 429 is
// final (bad secret, bad body), so it is not retried. Returns whether intake
// acknowledged with a 2xx.
export async function postToIntake(path: string, body: unknown, opts: PostOptions = {}): Promise<boolean> {
  if (!intakeConfigured()) return false
  const base = process.env.INTAKE_HOOK_URL!.trim().replace(/\/+$/, "")
  const url = `${base}/api/v1/intake-hooks/${path}`
  const doFetch = opts.fetchImpl ?? ((u, i) => fetch(u, i))
  const retries = opts.retries ?? 3
  const backoff = opts.backoffMs ?? defaultBackoff

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, backoff(attempt)))
    try {
      const res = await doFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Callback-Secret": process.env.INTAKE_HOOK_SECRET!,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      })
      if (res.ok) return true
      if (res.status !== 429 && res.status < 500) {
        console.error(`Intake hook ${path} rejected: HTTP ${res.status}`)
        return false
      }
      console.error(`Intake hook ${path} attempt ${attempt + 1} failed: HTTP ${res.status}`)
    } catch (e) {
      console.error(`Intake hook ${path} attempt ${attempt + 1} failed:`, e instanceof Error ? e.message : e)
    }
  }
  return false
}

export function notifyIntake(event: FaxReceivedEvent, opts?: PostOptions): Promise<boolean> {
  return postToIntake("fax-received", event, opts)
}

export function notifyIntakeStatus(event: FaxStatusEvent, opts?: PostOptions): Promise<boolean> {
  return postToIntake("fax-status", event, opts)
}
