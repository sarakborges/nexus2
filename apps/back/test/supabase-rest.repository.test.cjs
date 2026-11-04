const assert = require('node:assert/strict')
const { test } = require('node:test')
const { SupabaseRestRepository } = require('../dist/storage/supabase-rest.repository.js')

const url = 'https://example.supabase.co'
const key = 'sb_publishable_example'
const headerSecret = 'example-header-value'
const updatedAt = '2026-11-04T12:00:00.000Z'

function withFetch(t, handler) {
  const previous = global.fetch
  global.fetch = handler
  t.after(() => { global.fetch = previous })
}

test('GET reads collection records and version metadata with backend auth headers', async t => {
  let call
  withFetch(t, async (input, options) => {
    call = { input: String(input), options }
    return new Response(JSON.stringify([{
      records: [{ id: 'one' }],
      updated_at: updatedAt
    }]), { status: 200 })
  })

  const repo = new SupabaseRestRepository(url, key, headerSecret)
  assert.deepEqual(await repo.read('accounts'), [{ id: 'one' }])
  const requestUrl = new URL(call.input)
  assert.equal(requestUrl.searchParams.get('select'), 'records,updated_at')
  assert.equal(requestUrl.searchParams.get('collection'), 'eq.accounts')
  assert.equal(call.options.method, 'GET')
  assert.equal(call.options.headers.apikey, key)
  assert.equal(call.options.headers['x-nexus-api-secret'], headerSecret)
})

test('GET returns an empty array when a collection row does not exist', async t => {
  withFetch(t, async () => new Response('[]', { status: 200 }))
  const repo = new SupabaseRestRepository(url, key, headerSecret)
  assert.deepEqual(await repo.read('profiles'), [])
})

test('update uses a timestamp compare-and-swap PATCH for an existing collection', async t => {
  const records = [{ id: 'one' }, { id: 'two' }]
  let patchCall
  withFetch(t, async (input, options) => {
    const requestUrl = new URL(String(input))
    if (options.method === 'GET') {
      return new Response(JSON.stringify([{ records: [{ id: 'one' }], updated_at: updatedAt }]), { status: 200 })
    }
    patchCall = { url: requestUrl, options, body: JSON.parse(options.body) }
    return new Response(JSON.stringify([{
      records: patchCall.body.records,
      updated_at: patchCall.body.updated_at
    }]), { status: 200 })
  })

  const repo = new SupabaseRestRepository(url, key, headerSecret)
  assert.deepEqual(await repo.update('profiles', current => [...current, { id: 'two' }]), records)
  assert.equal(patchCall.options.method, 'PATCH')
  assert.equal(patchCall.url.searchParams.get('collection'), 'eq.profiles')
  assert.equal(patchCall.url.searchParams.get('updated_at'), 'eq.' + updatedAt)
  assert.equal(patchCall.options.headers.Prefer, 'return=representation')
  assert.equal(patchCall.options.headers['x-nexus-api-secret'], headerSecret)
  assert.deepEqual(patchCall.body.records, records)
  assert.ok(Date.parse(patchCall.body.updated_at) > Date.parse(updatedAt))
})

test('update inserts a missing collection without an upsert conflict policy', async t => {
  let postCall
  withFetch(t, async (input, options) => {
    if (options.method === 'GET') return new Response('[]', { status: 200 })
    postCall = { url: new URL(String(input)), options, body: JSON.parse(options.body) }
    return new Response(JSON.stringify([{
      records: postCall.body.records,
      updated_at: postCall.body.updated_at
    }]), { status: 201 })
  })

  const repo = new SupabaseRestRepository(url, key, headerSecret)
  const result = await repo.update('profiles', current => [...current, { id: 'created' }])
  assert.deepEqual(result, [{ id: 'created' }])
  assert.equal(postCall.options.method, 'POST')
  assert.equal(postCall.url.searchParams.has('on_conflict'), false)
  assert.equal(postCall.options.headers.Prefer, 'return=representation')
  assert.deepEqual(postCall.body.records, [{ id: 'created' }])
})

test('update retries after a stale snapshot and applies the callback to the latest records', async t => {
  let reads = 0
  let patches = 0
  let callbackCalls = 0
  let finalPayload
  withFetch(t, async (_input, options) => {
    if (options.method === 'GET') {
      reads += 1
      const records = reads === 1
        ? [{ id: 'initial' }]
        : [{ id: 'initial' }, { id: 'concurrent' }]
      return new Response(JSON.stringify([{
        records,
        updated_at: reads === 1 ? updatedAt : '2026-11-04T12:00:01.000Z'
      }]), { status: 200 })
    }

    patches += 1
    const body = JSON.parse(options.body)
    if (patches === 1) return new Response('[]', { status: 200 })
    finalPayload = body.records
    return new Response(JSON.stringify([{
      records: body.records,
      updated_at: body.updated_at
    }]), { status: 200 })
  })

  const repo = new SupabaseRestRepository(url, key, headerSecret)
  const result = await repo.update('relationships', current => {
    callbackCalls += 1
    return [...current, { id: 'new-write' }]
  })

  assert.equal(reads, 2)
  assert.equal(patches, 2)
  assert.equal(callbackCalls, 2)
  assert.deepEqual(finalPayload.map(item => item.id), ['initial', 'concurrent', 'new-write'])
  assert.deepEqual(result, finalPayload)
})

test('rejects malformed collection names and updater results', async t => {
  const repo = new SupabaseRestRepository(url, key, headerSecret)
  await assert.rejects(() => repo.read('bad name'), /Invalid collection name/)
  await assert.rejects(() => repo.update('bad name', records => records), /Invalid collection name/)

  withFetch(t, async () => new Response(JSON.stringify([{
    records: [],
    updated_at: updatedAt
  }]), { status: 200 }))
  await assert.rejects(() => repo.update('profiles', () => ({})), /must return an array/)
})

test('reports REST errors', async t => {
  withFetch(t, async () => new Response('denied', { status: 403 }))
  const repo = new SupabaseRestRepository(url, key, headerSecret)
  await assert.rejects(() => repo.read('accounts'), /Supabase storage request failed \(403\)/)
})


test('transaction commits multiple collection snapshots through one authenticated RPC', async t => {
  const calls = []
  withFetch(t, async (input, options) => {
    const requestUrl = new URL(String(input))
    calls.push({ url: requestUrl, options })
    if (options.method === 'GET') {
      const collection = requestUrl.searchParams.get('collection').slice(3)
      const records = collection === 'accounts' ? [{ id: 'account' }] : [{ id: 'profile' }]
      return new Response(JSON.stringify([{
        records,
        updated_at: collection === 'accounts' ? updatedAt : '2026-11-04T12:00:02.000Z'
      }]), { status: 200 })
    }

    assert.equal(requestUrl.pathname, '/rest/v1/rpc/nexus_commit_collections')
    assert.equal(options.headers.apikey, key)
    assert.equal(options.headers['x-nexus-api-secret'], headerSecret)
    return new Response(JSON.stringify({ committed: true }), { status: 200 })
  })

  const repo = new SupabaseRestRepository(url, key, headerSecret)
  const result = await repo.transaction(['profiles', 'accounts'], records => ({
    records: {
      ...records,
      accounts: [...records.accounts, { id: 'account-linked' }],
      profiles: [...records.profiles, { id: 'profile-created' }]
    },
    result: 'created'
  }))

  assert.equal(result, 'created')
  const rpcCalls = calls.filter(call => call.options.method === 'POST')
  assert.equal(rpcCalls.length, 1)
  const body = JSON.parse(rpcCalls[0].options.body)
  assert.deepEqual(body.p_changes.map(change => change.collection), ['accounts', 'profiles'])
  assert.equal(body.p_changes[0].expected_updated_at, updatedAt)
  assert.deepEqual(body.p_changes[0].records.map(record => record.id), ['account', 'account-linked'])
  assert.deepEqual(body.p_changes[1].records.map(record => record.id), ['profile', 'profile-created'])
})

test('transaction retries all collection snapshots after an atomic version conflict', async t => {
  const reads = new Map()
  let rpcAttempts = 0
  let updaterCalls = 0
  let secondAttemptAccounts
  withFetch(t, async (input, options) => {
    const requestUrl = new URL(String(input))
    if (options.method === 'GET') {
      const collection = requestUrl.searchParams.get('collection').slice(3)
      const count = (reads.get(collection) ?? 0) + 1
      reads.set(collection, count)
      const records = collection === 'accounts'
        ? (count === 1 ? [{ id: 'account' }] : [{ id: 'account' }, { id: 'concurrent' }])
        : [{ id: 'profile' }]
      return new Response(JSON.stringify([{
        records,
        updated_at: count === 1 ? updatedAt : '2026-11-04T12:00:01.000Z'
      }]), { status: 200 })
    }

    rpcAttempts += 1
    const body = JSON.parse(options.body)
    if (rpcAttempts === 1) return new Response(JSON.stringify({ committed: false }), { status: 200 })
    secondAttemptAccounts = body.p_changes.find(change => change.collection === 'accounts').records
    return new Response(JSON.stringify({ committed: true }), { status: 200 })
  })

  const repo = new SupabaseRestRepository(url, key, headerSecret)
  const result = await repo.transaction(['accounts', 'profiles'], records => {
    updaterCalls += 1
    return {
      records: {
        ...records,
        accounts: [...records.accounts, { id: 'new-account' }],
        profiles: [...records.profiles, { id: 'new-profile' }]
      },
      result: updaterCalls
    }
  })

  assert.equal(result, 2)
  assert.equal(rpcAttempts, 2)
  assert.equal(updaterCalls, 2)
  assert.equal(reads.get('accounts'), 2)
  assert.equal(reads.get('profiles'), 2)
  assert.deepEqual(secondAttemptAccounts.map(record => record.id), ['account', 'concurrent', 'new-account'])
})

test('transaction rejects empty, duplicate and invalid collection names', async () => {
  const repo = new SupabaseRestRepository(url, key, headerSecret)
  const updater = records => ({ records, result: undefined })
  await assert.rejects(() => repo.transaction([], updater), /non-empty list/)
  await assert.rejects(() => repo.transaction(['accounts', 'accounts'], updater), /unique collections/)
  await assert.rejects(() => repo.transaction(['bad name'], updater), /Invalid collection name/)
})
