const assert = require('node:assert/strict')
const { createHmac } = require('node:crypto')
const { test } = require('node:test')
const { AuthService } = require('../dist/api/auth/auth.service.js')

test('Realtime verification has a shared per-IP fixed-window limit', async () => {
  const calls = []
  const repository = {
    async consumeAuthRateLimit(keyHash, windowMs, maxRequests) {
      calls.push({ keyHash, windowMs, maxRequests })
      return true
    }
  }
  const config = {
    get: key => key === 'AUTH_RATE_LIMIT_SECRET' ? 'dedicated-rate-limit-secret' : undefined,
    getOrThrow: () => 'fallback-secret'
  }
  const service = new AuthService(repository, {}, config)

  await service.assertAuthAttemptAllowed('realtime-verify', '203.0.113.42')

  assert.deepEqual(calls, [{
    keyHash: createHmac('sha256', 'dedicated-rate-limit-secret')
      .update('nexus:auth:realtime-verify:203.0.113.42')
      .digest('hex'),
    windowMs: 60 * 1000,
    maxRequests: 120
  }])
})

test('Realtime verification rate limiting fails closed when the shared store rejects a request', async () => {
  const repository = {
    async consumeAuthRateLimit() { return false }
  }
  const config = {
    get: () => undefined,
    getOrThrow: () => 'fallback-secret'
  }
  const service = new AuthService(repository, {}, config)

  await assert.rejects(
    service.assertAuthAttemptAllowed('realtime-verify', '2001:db8::42'),
    error => error.getStatus() === 429 && error.message === 'AUTH_RATE_LIMIT_EXCEEDED'
  )
})
