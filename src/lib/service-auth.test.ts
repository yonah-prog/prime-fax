import { test, beforeEach } from "node:test"
import assert from "node:assert/strict"
import { validateServiceToken } from "./service-auth"

beforeEach(() => {
  process.env.INTAKE_SERVICE_TOKEN = "tok-abc-123"
})

test("accepts the service token with or without the Bearer prefix", () => {
  assert.equal(validateServiceToken("Bearer tok-abc-123"), true)
  assert.equal(validateServiceToken("bearer tok-abc-123"), true)
  assert.equal(validateServiceToken("tok-abc-123"), true)
})

test("rejects wrong, partial, empty and missing tokens", () => {
  assert.equal(validateServiceToken("Bearer tok-abc-124"), false)
  assert.equal(validateServiceToken("Bearer tok-abc"), false)
  assert.equal(validateServiceToken("Bearer "), false)
  assert.equal(validateServiceToken(null), false)
})

test("accepts nothing while INTAKE_SERVICE_TOKEN is unset", () => {
  delete process.env.INTAKE_SERVICE_TOKEN
  assert.equal(validateServiceToken("Bearer "), false)
  assert.equal(validateServiceToken(""), false)
})
