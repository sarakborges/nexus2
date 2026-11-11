const assert = require('node:assert/strict')
const { test } = require('node:test')
const { SupabaseRelationalRepository } = require('../dist/storage/supabase-relational.repository.js')

const url = 'https://example.supabase.co'
const key = 'sb_publishable_example'
const secret = 'example-header-value'

function withFetch(t, handler) {
  const previous = global.fetch
  global.fetch = handler
  t.after(() => { global.fetch = previous })
}

function rowsFor(call, table) {
  const parsed = new URL(String(call))
  return parsed.pathname === '/rest/v1/' + table
}

test('reads accounts from accounts, account_profiles and account_preferences tables', async t => {
  const calls = []
  withFetch(t, async (input, options) => {
    calls.push({ url: new URL(String(input)), options })
    const path = calls.at(-1).url.pathname
    if (path.endsWith('/nexus_collection_versions')) {
      return new Response(JSON.stringify([{ collection: 'accounts', revision: 3 }]), { status: 200 })
    }
    if (path.endsWith('/accounts')) {
      return new Response(JSON.stringify([{
        id: 'account-1',
        email: 'person@example.com',
        password_hash: 'hash',
        password_salt: 'salt',
        current_profile_id: 'profile-2'
      }]), { status: 200 })
    }
    if (path.endsWith('/account_profiles')) {
      return new Response(JSON.stringify([
        { account_id: 'account-1', profile_id: 'profile-2', position: 1 },
        { account_id: 'account-1', profile_id: 'profile-1', position: 0 }
      ]), { status: 200 })
    }
    if (path.endsWith('/account_preferences')) {
      return new Response(JSON.stringify([{
        account_id: 'account-1',
        language: 'pt-BR',
        theme: 'dark'
      }]), { status: 200 })
    }
    throw new Error('Unexpected request: ' + path)
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  const [account] = await repo.read('accounts')

  assert.deepEqual(account, {
    id: 'account-1',
    email: 'person@example.com',
    password: { hash: 'hash', salt: 'salt' },
    profiles: ['profile-1', 'profile-2'],
    currentProfile: 'profile-2',
    preferences: { language: 'pt-BR', theme: 'dark' }
  })
  assert.ok(calls.every(call => call.options.headers.apikey === key))
  assert.ok(calls.every(call => call.options.headers['x-nexus-api-secret'] === secret))
})

test('reads persisted feed activity rows from the feed_activities table', async t => {
  let call
  withFetch(t, async (input, options) => {
    call = { url: new URL(String(input)), options }
    return new Response(JSON.stringify([{
      id: 'post:post-1',
      type: 'profile_post',
      actor_profile_id: 'profile-1',
      target_profile_id: null,
      community_id: null,
      profile_post_id: 'post-1',
      role: null,
      updated_at_ms: '1700000000000'
    }]), { status: 200 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  assert.deepEqual(await repo.read('feed_activities'), [{
    id: 'post:post-1',
    type: 'profile_post',
    profileId: 'profile-1',
    friendId: null,
    communityId: null,
    postId: 'post-1',
    role: null,
    updatedAt: 1700000000000
  }])
  assert.equal(call.url.pathname, '/rest/v1/feed_activities')
  assert.equal(call.options.headers.Range, '0-999')
})

test('commits changed relational rows through the atomic database RPC', async t => {
  const calls = []
  withFetch(t, async (input, options) => {
    const url = new URL(String(input))
    calls.push({ url, options })
    if (url.pathname.endsWith('/nexus_collection_versions')) {
      return new Response(JSON.stringify([{ collection: 'profiles', revision: 7 }]), { status: 200 })
    }
    if (url.pathname.endsWith('/profiles')) {
      return new Response(JSON.stringify([{
        id: 'profile-1',
        name: 'Profile',
        url: 'profile',
        picture: '',
        about: '',
        type: 'social',
        created_at_ms: 100,
        last_activity_ms: 100
      }]), { status: 200 })
    }
    if (url.pathname.endsWith('/rpc/nexus_commit_relational')) {
      assert.equal(options.method, 'POST')
      assert.equal(options.headers.apikey, key)
      assert.equal(options.headers['x-nexus-api-secret'], secret)
      return new Response(JSON.stringify({ committed: true }), { status: 200 })
    }
    throw new Error('Unexpected request: ' + url.pathname)
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  const result = await repo.update('profiles', records => [
    ...records,
    { id: 'profile-2', name: 'Second' }
  ])

  assert.equal(result.length, 2)
  const commit = calls.find(call => call.url.pathname.endsWith('/rpc/nexus_commit_relational'))
  const body = JSON.parse(commit.options.body)
  assert.deepEqual(body.p_changes, [{
    collection: 'profiles',
    expected_revision: 7,
    records: [
      {
        id: 'profile-1',
        name: 'Profile',
        url: 'profile',
        picture: '',
        about: '',
        type: 'social',
        createdAt: 100,
        lastActivity: 100
      },
      { id: 'profile-2', name: 'Second' }
    ]
  }])
})

test('rejects unsupported and duplicate relational collections before querying', async () => {
  const repo = new SupabaseRelationalRepository(url, key, secret)
  const updater = records => ({ records, result: undefined })
  await assert.rejects(() => repo.transaction([], updater), /non-empty list/)
  await assert.rejects(() => repo.transaction(['profiles', 'profiles'], updater), /unique collections/)
  await assert.rejects(() => repo.read('unknown'), /Unsupported relational collection/)
})

test('reports PostgREST errors with the failing status', async t => {
  withFetch(t, async () => new Response('denied', { status: 403 }))
  const repo = new SupabaseRelationalRepository(url, key, secret)
  await assert.rejects(() => repo.read('feed_activities'), /Supabase relational request failed \(403\)/)
})


test('readByIds queries only the requested relational profiles', async t => {
  let call
  withFetch(t, async input => {
    call = new URL(String(input))
    return new Response(JSON.stringify([{
      id: 'profile-1',
      name: 'Requested',
      url: 'requested',
      picture: '',
      about: '',
      type: 'social',
      created_at_ms: '100',
      last_activity_ms: '200'
    }]), { status: 200 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  const result = await repo.readByIds('profiles', ['profile-1'])

  assert.deepEqual(result, [{
    id: 'profile-1',
    name: 'Requested',
    url: 'requested',
    picture: '',
    about: '',
    type: 'social',
    createdAt: 100,
    lastActivity: 200
  }])
  assert.equal(call.pathname, '/rest/v1/profiles')
  assert.equal(call.searchParams.get('id'), 'in.("profile-1")')
})

test('findAccountByEmail filters accounts in Postgres and maps only that account relation data', async t => {
  const calls = []
  withFetch(t, async input => {
    const requestUrl = new URL(String(input))
    calls.push(requestUrl)
    if (requestUrl.pathname.endsWith('/accounts')) {
      assert.equal(requestUrl.searchParams.get('email'), 'eq.person@example.com')
      return new Response(JSON.stringify([{
        id: 'account-1',
        email: 'person@example.com',
        password_hash: 'hash',
        password_salt: 'salt',
        current_profile_id: 'profile-1'
      }]), { status: 200 })
    }
    if (requestUrl.pathname.endsWith('/account_profiles')) {
      assert.equal(requestUrl.searchParams.get('account_id'), 'in.("account-1")')
      return new Response(JSON.stringify([
        { account_id: 'account-1', profile_id: 'profile-1', position: 0 }
      ]), { status: 200 })
    }
    if (requestUrl.pathname.endsWith('/account_preferences')) {
      assert.equal(requestUrl.searchParams.get('account_id'), 'in.("account-1")')
      return new Response(JSON.stringify([]), { status: 200 })
    }
    throw new Error('Unexpected request: ' + requestUrl.pathname)
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  const account = await repo.findAccountByEmail('person@example.com')

  assert.deepEqual(account, {
    id: 'account-1',
    email: 'person@example.com',
    password: { hash: 'hash', salt: 'salt' },
    profiles: ['profile-1'],
    currentProfile: 'profile-1'
  })
  assert.equal(calls.length, 3)
})
