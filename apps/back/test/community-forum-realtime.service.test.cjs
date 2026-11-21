const assert = require('node:assert/strict')
const { createHmac } = require('node:crypto')
const { test } = require('node:test')
const { CommunityForumRealtimeService } = require('../dist/api/domain/community-forum-realtime.service.js')

const signingSecret = 'jwt-refresh-secret-for-tests'
const signatureContext = 'nexus:forum-topic-changed:v1'

function signTopicChange(topicId, changedAt) {
  return createHmac('sha256', signingSecret)
    .update(`${signatureContext}\n${topicId}\n${changedAt}`)
    .digest('base64url')
}

test('publishes a signed topic change through the Supabase Realtime Broadcast REST API', async t => {
  const previousFetch = global.fetch
  let request
  global.fetch = async (url, options) => {
    request = { url: String(url), options }
    return new Response('{}', { status: 202 })
  }
  t.after(() => { global.fetch = previousFetch })

  const config = {
    SUPABASE_URL: 'https://example.supabase.co/',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_public',
    SUPABASE_STORAGE_SECRET_KEY: 'sb_secret_server_only',
    JWT_REFRESH_SECRET: signingSecret
  }
  const service = new CommunityForumRealtimeService({
    get: key => config[key]
  })

  assert.deepEqual(service.getPublicConfig(), {
    enabled: true,
    supabaseUrl: 'https://example.supabase.co',
    publishableKey: 'sb_publishable_public'
  })

  await service.publishTopicChanged('550e8400-e29b-41d4-a716-446655440000')

  assert.equal(request.url, 'https://example.supabase.co/realtime/v1/api/broadcast')
  assert.equal(request.options.method, 'POST')
  assert.equal(request.options.headers.apikey, 'sb_secret_server_only')
  const body = JSON.parse(request.options.body)
  const message = body.messages[0]
  assert.equal(body.messages.length, 1)
  assert.equal(message.topic, 'nexus-forum-topic-550e8400-e29b-41d4-a716-446655440000')
  assert.equal(message.event, 'topic_changed')
  assert.equal(typeof message.payload.changedAt, 'number')
  assert.match(message.payload.signature, /^[A-Za-z0-9_-]{43}$/)
  assert.equal(service.verifyTopicChanged(
    '550e8400-e29b-41d4-a716-446655440000',
    message.payload.changedAt,
    message.payload.signature
  ), true)
  assert.equal(service.verifyTopicChanged(
    '550e8400-e29b-41d4-a716-446655440001',
    message.payload.changedAt,
    message.payload.signature
  ), false)
})

test('rejects forged, modified, stale, and future topic notifications', () => {
  const service = new CommunityForumRealtimeService({
    get: key => key === 'JWT_REFRESH_SECRET' ? signingSecret : undefined
  })
  const topicId = '550e8400-e29b-41d4-a716-446655440000'
  const now = Date.now()

  assert.equal(service.verifyTopicChanged(topicId, now, 'A'.repeat(43)), false)
  assert.equal(service.verifyTopicChanged(topicId, now + 1, signTopicChange(topicId, now)), false)
  assert.equal(service.verifyTopicChanged(
    topicId,
    now - 3 * 60 * 1000,
    signTopicChange(topicId, now - 3 * 60 * 1000)
  ), false)
  assert.equal(service.verifyTopicChanged(
    topicId,
    now + 60 * 1000,
    signTopicChange(topicId, now + 60 * 1000)
  ), false)
})

test('does not publish when Supabase Realtime server credentials are unavailable', async t => {
  const previousFetch = global.fetch
  let called = false
  global.fetch = async () => {
    called = true
    return new Response('{}', { status: 202 })
  }
  t.after(() => { global.fetch = previousFetch })

  const service = new CommunityForumRealtimeService({
    get: key => ({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_public'
    })[key]
  })

  await service.publishTopicChanged('topic-123')
  assert.equal(called, false)
})

test('does not publish unsigned events when the signing secret is unavailable', async t => {
  const previousFetch = global.fetch
  let called = false
  global.fetch = async () => {
    called = true
    return new Response('{}', { status: 202 })
  }
  t.after(() => { global.fetch = previousFetch })

  const service = new CommunityForumRealtimeService({
    get: key => ({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_public',
      SUPABASE_STORAGE_SECRET_KEY: 'sb_secret_server_only'
    })[key]
  })

  await service.publishTopicChanged('topic-123')
  assert.equal(called, false)
})

test('does not let malformed Supabase URL configuration fail the forum mutation', async () => {
  const service = new CommunityForumRealtimeService({
    get: key => ({
      SUPABASE_URL: 'not-a-valid-url',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_public',
      SUPABASE_STORAGE_SECRET_KEY: 'sb_secret_server_only',
      JWT_REFRESH_SECRET: signingSecret
    })[key]
  })

  await assert.doesNotReject(service.publishTopicChanged('topic-123'))
})


test('bounds realtime notification latency and keeps timeout failures non-fatal', async t => {
  const previousFetch = global.fetch
  const previousTimeout = AbortSignal.timeout
  let timeoutMs
  global.fetch = async (_url, options) => {
    assert.equal(options.signal.aborted, true)
    throw options.signal.reason
  }
  AbortSignal.timeout = milliseconds => {
    timeoutMs = milliseconds
    const controller = new AbortController()
    controller.abort(new Error('simulated realtime timeout'))
    return controller.signal
  }
  t.after(() => {
    global.fetch = previousFetch
    AbortSignal.timeout = previousTimeout
  })

  const service = new CommunityForumRealtimeService({
    get: key => ({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_public',
      SUPABASE_STORAGE_SECRET_KEY: 'sb_secret_server_only',
      JWT_REFRESH_SECRET: signingSecret
    })[key]
  })

  await assert.doesNotReject(service.publishTopicChanged('topic-123'))
  assert.equal(timeoutMs, 5000)
})
