const assert = require('node:assert/strict')
const { test } = require('node:test')
const { CommunityForumRealtimeService } = require('../dist/api/domain/community-forum-realtime.service.js')

test('publishes a topic change through the Supabase Realtime Broadcast REST API', async t => {
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
    SUPABASE_STORAGE_SECRET_KEY: 'sb_secret_server_only'
  }
  const service = new CommunityForumRealtimeService({
    get: key => config[key]
  })

  assert.deepEqual(service.getPublicConfig(), {
    enabled: true,
    supabaseUrl: 'https://example.supabase.co',
    publishableKey: 'sb_publishable_public'
  })

  await service.publishTopicChanged('topic-123')

  assert.equal(request.url, 'https://example.supabase.co/realtime/v1/api/broadcast')
  assert.equal(request.options.method, 'POST')
  assert.equal(request.options.headers.apikey, 'sb_secret_server_only')
  const body = JSON.parse(request.options.body)
  assert.equal(body.messages.length, 1)
  assert.equal(body.messages[0].topic, 'nexus-forum-topic-topic-123')
  assert.equal(body.messages[0].event, 'topic_changed')
  assert.equal(typeof body.messages[0].payload.changedAt, 'number')
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
