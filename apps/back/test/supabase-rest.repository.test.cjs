const assert = require('node:assert/strict')
const { test } = require('node:test')
const { SupabaseRestRepository } = require('../dist/storage/supabase-rest.repository.js')

const projectUrl = 'https://example.supabase.co'
const publishableKey = 'sb_publishable_test_key'
const apiSecret = 'test-api-secret'

test('reads records through the private Supabase RPC', async (t) => {
  const originalFetch = global.fetch
  let requestedUrl
  let requestedOptions

  global.fetch = async (url, options) => {
    requestedUrl = String(url)
    requestedOptions = options
    return new Response(JSON.stringify([{ id: 'account-1' }]), { status: 200 })
  }
  t.after(() => { global.fetch = originalFetch })

  const repository = new SupabaseRestRepository(projectUrl, publishableKey, apiSecret)
  const records = await repository.read('accounts')

  assert.deepEqual(records, [{ id: 'account-1' }])
  assert.equal(requestedUrl, `${projectUrl}/rest/v1/rpc/nexus_read_collection`)
  assert.equal(requestedOptions.method, 'POST')
  assert.equal(requestedOptions.headers.apikey, publishableKey)
  assert.equal(requestedOptions.headers.Authorization, undefined)
  assert.deepEqual(JSON.parse(requestedOptions.body), {
    p_collection: 'accounts',
    p_secret: apiSecret
  })
})

test('returns an empty collection when the RPC returns an empty array', async (t) => {
  const originalFetch = global.fetch
  global.fetch = async () => new Response('[]', { status: 200 })
  t.after(() => { global.fetch = originalFetch })

  const repository = new SupabaseRestRepository(projectUrl, publishableKey, apiSecret)
  assert.deepEqual(await repository.read('profiles'), [])
})

test('writes collection data through the private Supabase RPC', async (t) => {
  const originalFetch = global.fetch
  let requestedUrl
  let requestedOptions

  global.fetch = async (url, options) => {
    requestedUrl = String(url)
    requestedOptions = options
    return new Response('true', { status: 200 })
  }
  t.after(() => { global.fetch = originalFetch })

  const repository = new SupabaseRestRepository(projectUrl, publishableKey, apiSecret)
  const records = [{ id: 'profile-1' }]
  await repository.write('profiles', records)

  assert.equal(requestedUrl, `${projectUrl}/rest/v1/rpc/nexus_write_collection`)
  assert.equal(requestedOptions.method, 'POST')
  assert.equal(requestedOptions.headers.apikey, publishableKey)
  assert.deepEqual(JSON.parse(requestedOptions.body), {
    p_collection: 'profiles',
    p_records: records,
    p_secret: apiSecret
  })
})

test('rejects collection names outside the allowed format', async () => {
  const repository = new SupabaseRestRepository(projectUrl, publishableKey, apiSecret)
  await assert.rejects(() => repository.read('invalid collection'), /Invalid collection name/)
})

test('rejects non-array collection data before making a request', async () => {
  const repository = new SupabaseRestRepository(projectUrl, publishableKey, apiSecret)
  await assert.rejects(() => repository.write('profiles', {}), /must be an array/)
})

test('surfaces Supabase RPC errors', async (t) => {
  const originalFetch = global.fetch
  global.fetch = async () => new Response('permission denied', { status: 403 })
  t.after(() => { global.fetch = originalFetch })

  const repository = new SupabaseRestRepository(projectUrl, publishableKey, apiSecret)
  await assert.rejects(() => repository.read('accounts'), /Supabase RPC request failed \(403\)/)
})
