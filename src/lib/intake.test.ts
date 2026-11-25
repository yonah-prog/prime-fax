import { test, beforeEach } from "node:test"
import assert from "node:assert/strict"
import { notifyIntake, notifyIntakeStatus, shouldNotifyIntake, type FaxReceivedEvent } from "./intake"

const event: FaxReceivedEvent = {
  faxId: "11111111-1111-1111-1111-111111111111",
  from: "+15550001111",
  to: "+15550002222",
  lineLabel: "Referrals",
  pages: 4,
  receivedAt: "2026-11-24T15:00:00.000Z",
}

type Call = { url: string; init: RequestInit }

function fakeFetch(statuses: (number | Error)[]) {
  const calls: Call[] = []
  const impl = async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    const next = statuses[Math.min(calls.length - 1, statuses.length - 1)]
    if (next instanceof Error) throw next
    return new Response(null, { status: next })
  }
  return { calls, impl }
}

const fast = { backoffMs: () => 0 }

beforeEach(() => {
  process.env.INTAKE_HOOK_URL = "https://intake.example.test/"
  process.env.INTAKE_HOOK_SECRET = "s3cret"
})

test("an enabled line with a new stored fax is announced", () => {
  assert.equal(shouldNotifyIntake({ inserted: true, hasFile: true, line: { intakeEnabled: true } }), true)
})

test("disabled lines, duplicate webhooks, missing files and unknown lines are not announced", () => {
  assert.equal(shouldNotifyIntake({ inserted: true, hasFile: true, line: { intakeEnabled: false } }), false)
  assert.equal(shouldNotifyIntake({ inserted: false, hasFile: true, line: { intakeEnabled: true } }), false)
  assert.equal(shouldNotifyIntake({ inserted: true, hasFile: false, line: { intakeEnabled: true } }), false)
  assert.equal(shouldNotifyIntake({ inserted: true, hasFile: true, line: undefined }), false)
})

test("nothing is announced while the hook is not configured", async () => {
  delete process.env.INTAKE_HOOK_URL
  assert.equal(shouldNotifyIntake({ inserted: true, hasFile: true, line: { intakeEnabled: true } }), false)
  const f = fakeFetch([200])
  assert.equal(await notifyIntake(event, { fetchImpl: f.impl, ...fast }), false)
  assert.equal(f.calls.length, 0)
})

test("a successful announcement posts exactly once, with the secret and no PHI beyond the event", async () => {
  const f = fakeFetch([202])
  assert.equal(await notifyIntake(event, { fetchImpl: f.impl, ...fast }), true)
  assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0].url, "https://intake.example.test/api/v1/intake-hooks/fax-received")
  const headers = f.calls[0].init.headers as Record<string, string>
  assert.equal(headers["X-Callback-Secret"], "s3cret")
  assert.deepEqual(JSON.parse(f.calls[0].init.body as string), event)
})

test("5xx and network errors are retried, then succeed", async () => {
  const f = fakeFetch([503, new Error("ECONNRESET"), 200])
  assert.equal(await notifyIntake(event, { fetchImpl: f.impl, ...fast }), true)
  assert.equal(f.calls.length, 3)
})

test("gives up after the retry budget", async () => {
  const f = fakeFetch([500])
  assert.equal(await notifyIntake(event, { fetchImpl: f.impl, retries: 3, ...fast }), false)
  assert.equal(f.calls.length, 4)
})

test("a 401 (bad secret) is final and not retried; 429 is retried", async () => {
  const bad = fakeFetch([401])
  assert.equal(await notifyIntake(event, { fetchImpl: bad.impl, ...fast }), false)
  assert.equal(bad.calls.length, 1)

  const limited = fakeFetch([429, 200])
  assert.equal(await notifyIntake(event, { fetchImpl: limited.impl, ...fast }), true)
  assert.equal(limited.calls.length, 2)
})

test("fax-back status goes to the fax-status hook", async () => {
  const f = fakeFetch([200])
  await notifyIntakeStatus({ faxId: event.faxId, referenceId: "ref-1", status: "failed", error: "busy" }, { fetchImpl: f.impl, ...fast })
  assert.equal(f.calls[0].url, "https://intake.example.test/api/v1/intake-hooks/fax-status")
  assert.deepEqual(JSON.parse(f.calls[0].init.body as string), { faxId: event.faxId, referenceId: "ref-1", status: "failed", error: "busy" })
})
