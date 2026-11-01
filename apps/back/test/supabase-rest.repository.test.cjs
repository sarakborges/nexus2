const assert = require('node:assert/strict')
const { test } = require('node:test')
const { SupabaseRestRepository } = require('../dist/storage/supabase-rest.repository.js')

const projectUrl = 'https://example.supabase.co'
const serviceRoleKey = 'test-service-role-key'

test('reads collection records from Supabase REST', async (t) => {
  const originalFetch = global.fetch
  let requestedUrl
  let requestedOptions

  global.fetch = async (url, options) => {
    requestedUrl = String(url)
    requestedOptions = options
    return new Response(JSON.stringify([{ records: [{ id: 'account-1' }] }]), { status: 200 })
  }
  t.after(() => { global.fetch = originalFetch })

  const repository = new SupabaseRestRepository(projectUrl, serviceRoleKey)
  const records = await repository.read('accounts')

  assert.deepEqual(records, [{ id: 'account-1' }])
  assert.match(requestedUrl, /collection=eq\.accounts/)
  assert.equal(requestedOptions.headers.apikey, serviceRoleKey)
  assert.equal(requestedOptions.headers.Authorization, `Bearer ${serviceRoleKey}`)
})

test('returns an empty collection when no row exists yet', async (t) => {
  const originalFetch = global.fetch
  global.fetch = async () => new Response('[]', { status: 200 })
  t.after(() => { global.fetch = originalFetch })

  const repository = new SupabaseRestRepository(projectUrl, serviceRoleKey)
  assert.deepEqual(await repository.read('profiles'), [])
})

test('upserts collection data as JSONB', async (t) => {
  const originalFetch = global.fetch
  let requestedUrl
  let requestedOptions

  global.fetch = async (url, options) => {
    requestedUrl = String(url)
    requestedOptions = options
    return new Response(null, { status: 204 })
  }
  t.after(() => { global.fetch = originalFetch })

  const repository = new SupabaseRestRepository(projectUrl, serviceRoleKey)
  const records = [{ id: 'profile-1' }]
  await repository.write('profiles', records)

  assert.match(requestedUrl, /on_conflict=collection/)
  assert.equal(requestedOptions.method, 'POST')
  assert.equal(requestedOptions.headers.Prefer, 'resolution=merge-duplicates,return=minimal')
  assert.deepEqual(JSON.parse(requestedOptions.body).records, records)
})

test('rejects unsafe collection names before making a request', async () => {
  const repository = new SupabaseRestRepository(projectUrl, serviceRoleKey)
  await assert.rejects(() => repository.read('../accounts'), /Invalid collection name/)
})

test('surfaces Supabase REST errors', async (t) => {
  const originalFetch = global.fetch
  global.fetch = async () => new Response('permission denied', { status: 403 })
  t.after(() => { global.fetch = originalFetch })

  const repository = new SupabaseRestRepository(projectUrl, serviceRoleKey)
  await assert.rejects(() => repository.read('accounts'), /Supabase storage request failed \(403\)/)
})
