const assert = require('node:assert/strict')
const { test } = require('node:test')
const { SupabaseAccountRepository } = require('../dist/storage/adapters/accounts.repository.js')

function withFetch(t, implementation) {
  const original = global.fetch
  global.fetch = implementation
  t.after(() => { global.fetch = original })
}

test('credential lookup fetches only the account row and defers membership/preferences reads', async t => {
  const requests = []
  withFetch(t, async (input, init) => {
    requests.push({ url: new URL(String(input)), init })
    return new Response(JSON.stringify([{
      id: 'account-1',
      email: 'person@example.com',
      password_hash: 'password-hash',
      password_salt: 'password-salt',
      current_profile_id: 'profile-1'
    }]), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  })

  const repository = new SupabaseAccountRepository(
    'https://project.example.supabase.co',
    'publishable-key',
    'api-secret'
  )
  const result = await repository.findAccountByEmail('person@example.com')

  assert.deepEqual(result, {
    id: 'account-1',
    email: 'person@example.com',
    password: { hash: 'password-hash', salt: 'password-salt' }
  })
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url.pathname, '/rest/v1/accounts')
  assert.equal(requests[0].url.searchParams.get('email'), 'eq.person@example.com')
  assert.equal(requests.some(request =>
    ['account_profiles', 'account_preferences'].includes(request.url.pathname.split('/').pop())
  ), false)
})

test('credential lookup returns null with a single account query when the email is missing', async t => {
  let requests = 0
  withFetch(t, async () => {
    requests += 1
    return new Response('[]', {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  })

  const repository = new SupabaseAccountRepository(
    'https://project.example.supabase.co',
    'publishable-key',
    'api-secret'
  )
  assert.equal(await repository.findAccountByEmail('missing@example.com'), null)
  assert.equal(requests, 1)
})
