const test = require('node:test')
const assert = require('node:assert/strict')
const { AccountService } = require('../dist/api/auth/account.service.js')

function createAccountService(accounts) {
  const calls = []
  const repository = {
    async read() {
      throw new Error('FULL_ACCOUNT_COLLECTION_READ_NOT_EXPECTED')
    },
    async readByIds(collection, ids) {
      calls.push({ collection, ids: [...ids] })
      const requested = new Set(ids)
      return structuredClone(accounts.filter(account =>
        collection === 'accounts' && requested.has(account.id)
      ))
    }
  }

  return {
    service: new AccountService(repository),
    calls
  }
}

const account = (overrides = {}) => ({
  id: 'user-1',
  email: 'person@example.com',
  password: { hash: 'hash', salt: 'salt' },
  profiles: ['profile-1'],
  currentProfile: 'profile-1',
  ...overrides
})

test('getUser reads a single account by ID and returns only public fields', async () => {
  const { service, calls } = createAccountService([
    account(),
    account({ id: 'other-user', email: 'other@example.com' })
  ])

  const result = await service.getUser('user-1')

  assert.deepEqual(calls, [{ collection: 'accounts', ids: ['user-1'] }])
  assert.deepEqual(result, {
    id: 'user-1',
    email: 'person@example.com',
    profiles: ['profile-1'],
    currentProfile: 'profile-1'
  })
  assert.equal(Object.hasOwn(result, 'password'), false)
})

test('getPreferences reads a single account and keeps system defaults', async () => {
  const { service, calls } = createAccountService([account()])

  assert.deepEqual(await service.getPreferences('user-1'), {
    language: 'system',
    theme: 'system'
  })
  assert.deepEqual(calls, [{ collection: 'accounts', ids: ['user-1'] }])
})

test('getPreferences preserves saved settings for the selected account', async () => {
  const { service } = createAccountService([
    account({ preferences: { language: 'en-US', theme: 'dark' } })
  ])

  assert.deepEqual(await service.getPreferences('user-1'), {
    language: 'en-US',
    theme: 'dark'
  })
})

test('ownsProfile only checks the selected account', async () => {
  const { service, calls } = createAccountService([
    account(),
    account({ id: 'other-user', profiles: ['unrelated-profile'] })
  ])

  assert.equal(await service.ownsProfile('user-1', 'profile-1'), true)
  assert.equal(await service.ownsProfile('user-1', 'unrelated-profile'), false)
  assert.deepEqual(calls, [
    { collection: 'accounts', ids: ['user-1'] },
    { collection: 'accounts', ids: ['user-1'] }
  ])
})

test('getUser still reports a missing account', async () => {
  const { service } = createAccountService([])

  await assert.rejects(
    service.getUser('missing-user'),
    error => error.getStatus() === 401 && error.message === 'ACCOUNT_NOT_FOUND'
  )
})
