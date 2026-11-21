const assert = require('node:assert/strict')
const { test } = require('node:test')
const { RealtimeController } = require('../dist/api/realtime.controller.js')

const event = {
  topicId: '550e8400-e29b-41d4-a716-446655440000',
  changedAt: 1_800_000_000_000,
  signature: 'A'.repeat(43)
}

test('Realtime verification applies the IP limit before checking the signature', async () => {
  const calls = []
  const auth = {
    async assertAuthAttemptAllowed(action, ip) {
      calls.push(['limit', action, ip])
    }
  }
  const realtime = {
    verifyTopicChanged(topicId, changedAt, signature) {
      calls.push(['verify', topicId, changedAt, signature])
      return true
    }
  }
  const controller = new RealtimeController(realtime, auth)

  const result = await controller.verifyTopicChanged(event, '203.0.113.42')

  assert.deepEqual(result, { valid: true })
  assert.deepEqual(calls, [
    ['limit', 'realtime-verify', '203.0.113.42'],
    ['verify', event.topicId, event.changedAt, event.signature]
  ])
})

test('Realtime verification does not run signature validation when the IP limit is exceeded', async () => {
  let signatureChecks = 0
  const auth = {
    async assertAuthAttemptAllowed() {
      const error = new Error('AUTH_RATE_LIMIT_EXCEEDED')
      error.getStatus = () => 429
      throw error
    }
  }
  const realtime = {
    verifyTopicChanged() {
      signatureChecks += 1
      return true
    }
  }
  const controller = new RealtimeController(realtime, auth)

  await assert.rejects(
    controller.verifyTopicChanged(event, '203.0.113.42'),
    error => error.getStatus() === 429
  )
  assert.equal(signatureChecks, 0)
})
