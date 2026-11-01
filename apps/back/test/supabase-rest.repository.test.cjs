const assert = require('node:assert/strict')
const { test } = require('node:test')
const { SupabaseRestRepository } = require('../dist/storage/supabase-rest.repository.js')

const projectUrl = 'https://example.supabase.co'
const publishableKey = 'sb_publishable_test_key'
const apiSecret = 'test-api-secret'

test('reads records from the protected collection endpoint', async (t) => {
  const originalFetch = global.fetch
  let requestedUrl
  let requestedOptions

  global.fetch = async (url, options) => {
    requestedUrl = String(url)
    requestedOptions = options
    return new Response(JSON.stringify([{ records: [{ id: 'account-1' }] }]), { status: 200 })
  }
  t.after(() => { global.fetch = originalFetch })

  const repository = new SupabaseRestRepository(projectUrl, publishableKey, apiSecret)
  const records = await repository.read('accounts')
  const url = new URL(requestedUrl)

  assert.deepEqual(records, [{ id: 'account-1' }])
  assert.equal(url.pathname, '/rest/v1/nexus_collections')
  assert.equal(url.searchParams.get('select'), 'records')
  assert.equal(url.searchParams.get('collection'), 'eq.accounts')
  assert.equal(requestedOptions.method, 'GET')
  assert.equal(requestedOptions.headers.apikey, publishableKey)
  assert.equal(requestedOptions.headers['x-nexus-api-secret'], apiSecret)
  assert.equal(requestedOptions.headers.Authorization, undefined)
})

test('returns an empty collection when no row exists', async (t) => {
  const originalFetch = global.fetch
  global.fetch = async () => new Response('[]', { status: 200 })
  t.after(() => { global.fetch = originalFetch })

  const repository = new SupabaseRestRepository(projectUrl, publishableKey, apiSecret)
  assert.deepEqual(await repository.read('profiles'), [])
})

test('upserts collection records as JSONB', async (t) => {
  const originalFetch = global.fetch
  let requestedUrl
  let requestedOptions

  global.fetch = async (url, options) => {
    requestedUrl = String(url)
    requestedOptions = options
    return new Response(null, { status: 204 })
  }
  t.after(() => { global.fetch = originalFetch })

  const repository = new SupabaseRestRepository(projectUrl, publishableKey, apiSecret)
  const records = [{ id: 'profile-1' }]
  await repository.write('profiles', records)

  assert.equal(requestedUrl, `${projectUrl}/rest/v1/nexus_collections?on_conflict=collection`)
  assert.equal(requestedOptions.method, 'POST')
  assert.equal(requestedOptions.headers.apikey, publishableKey)
  assert.equal(requestedOptions.headers['x-nexus-api-secret'], apiSecret)
  assert.equal(requestedOptions.headers.Prefer, 'resolution=merge-duplicates,return=minimal')
  assert.deepEqual(JSON.parse(requestedOptions.body).records, records)
})

test('rejects an invalid collection name before making a request', async () => {
  const repository = new SupabaseRestRepository(projectUrl, publishableKey, apiSecret)
  await assert.rejects(() => repository.read('invalid collection'), /Invalid collection name/)
})

test('rejects non-array records before making a request', async () => {
  const repository = new SupabaseRestRepository(projectUrl, publishableKey, apiSecret)
  await assert.rejects(() => repository.write('profiles', {}), /must be an array/)
})

test('surfaces Supabase REST errors', async (t) => {
  const originalFetch = global.fetch
  global.fetch = async () => new Response('permission denied', { status: 403 })
  t.after(() => { global.fetch = originalFetch })

  const repository = new SupabaseRestRepository(projectUrl, publishableKey, apiSecret)
  await assert.rejects(() => repository.read('accounts'), /Supabase storage request failed \(403\)/)
})
