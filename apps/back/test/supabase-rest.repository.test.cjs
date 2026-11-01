const assert = require('node:assert/strict')
const { test } = require('node:test')
const { SupabaseRestRepository } = require('../dist/storage/supabase-rest.repository.js')

const url = 'https://example.supabase.co'
const key = 'sb_publishable_example'
const headerSecret = 'example-header-value'

test('GET reads the selected collection and sends server auth header', async (t) => {
  const previous = global.fetch
  let call
  global.fetch = async (input, options) => {
    call = { input: String(input), options }
    return new Response(JSON.stringify([{ records: [{ id: 'one' }] }]), { status: 200 })
  }
  t.after(() => { global.fetch = previous })

  const repo = new SupabaseRestRepository(url, key, headerSecret)
  assert.deepEqual(await repo.read('accounts'), [{ id: 'one' }])
  assert.match(call.input, /nexus_collections/)
  assert.equal(call.options.method, 'GET')
  assert.equal(call.options.headers.apikey, key)
  assert.equal(call.options.headers['x-nexus-api-secret'], headerSecret)
})

test('GET returns an empty array for an empty result', async (t) => {
  const previous = global.fetch
  global.fetch = async () => new Response('[]', { status: 200 })
  t.after(() => { global.fetch = previous })

  const repo = new SupabaseRestRepository(url, key, headerSecret)
  assert.deepEqual(await repo.read('profiles'), [])
})

test('POST upserts JSON records with the backend-only header', async (t) => {
  const previous = global.fetch
  let call
  global.fetch = async (input, options) => {
    call = { input: String(input), options }
    return new Response(null, { status: 204 })
  }
  t.after(() => { global.fetch = previous })

  const repo = new SupabaseRestRepository(url, key, headerSecret)
  const records = [{ id: 'one' }]
  await repo.write('profiles', records)

  assert.match(call.input, /on_conflict=collection/)
  assert.equal(call.options.method, 'POST')
  assert.equal(call.options.headers['x-nexus-api-secret'], headerSecret)
  assert.deepEqual(JSON.parse(call.options.body).records, records)
})

test('rejects malformed collection input', async () => {
  const repo = new SupabaseRestRepository(url, key, headerSecret)
  await assert.rejects(() => repo.read('bad name'), /Invalid collection name/)
  await assert.rejects(() => repo.write('profiles', {}), /must be an array/)
})

test('reports REST errors', async (t) => {
  const previous = global.fetch
  global.fetch = async () => new Response('denied', { status: 403 })
  t.after(() => { global.fetch = previous })

  const repo = new SupabaseRestRepository(url, key, headerSecret)
  await assert.rejects(() => repo.read('accounts'), /Supabase storage request failed \(403\)/)
})
