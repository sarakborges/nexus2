const test = require('node:test')
const assert = require('node:assert/strict')
const { AccountService } = require('../dist/api/auth/account.service.js')

function createAccountService(accounts) {
  const calls = []
  const repository = {
    async getAccountById(id) {
      calls.push({ method: 'getAccountById', id })
      return structuredClone(accounts.find(account => account.id === id) ?? null)
    },
    async changeAccountProfile(change) {
      calls.push({ method: 'changeAccountProfile', ...structuredClone(change) })
      const account = accounts.find(item => item.id === change.accountId)
      if (!account) throw new Error('ACCOUNT_NOT_FOUND')

      const profiles = [...account.profiles]
      if (change.action === 'select') {
        if (!profiles.includes(change.profileId)) throw new Error('PROFILE_NOT_OWNED')
        account.currentProfile = change.profileId
        return
      }
      if (change.action === 'add') {
        if (!profiles.includes(change.profileId)) profiles.push(change.profileId)
        account.profiles = profiles
        if (change.makeCurrent || !account.currentProfile) account.currentProfile = change.profileId
        return
      }

      if (!profiles.includes(change.profileId)) return
      account.profiles = profiles.filter(id => id !== change.profileId)
      if (account.currentProfile === change.profileId) {
        account.currentProfile = change.previousCurrentProfileId &&
          account.profiles.includes(change.previousCurrentProfileId)
          ? change.previousCurrentProfileId
          : account.profiles[0] ?? null
      }
    },
    async updateAccountPreferences(userId, preferences) {
      calls.push({ method: 'updateAccountPreferences', userId, preferences: structuredClone(preferences) })
      const account = accounts.find(item => item.id === userId)
      if (!account) throw new Error('ACCOUNT_NOT_FOUND')
      account.preferences = {
        language: 'system',
        theme: 'system',
        ...account.preferences,
        ...preferences
      }
      return structuredClone(account.preferences)
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

test('getUser reads one account by ID and returns only public fields', async () => {
  const { service, calls } = createAccountService([
    account(),
    account({ id: 'other-user', email: 'other@example.com' })
  ])

  const result = await service.getUser('user-1')

  assert.deepEqual(calls, [{ method: 'getAccountById', id: 'user-1' }])
  assert.deepEqual(result, {
    id: 'user-1',
    email: 'person@example.com',
    profiles: ['profile-1'],
    currentProfile: 'profile-1'
  })
  assert.equal(Object.hasOwn(result, 'password'), false)
})

test('getPreferences reads the selected account and keeps system defaults', async () => {
  const { service, calls } = createAccountService([account()])

  assert.deepEqual(await service.getPreferences('user-1'), {
    language: 'system',
    theme: 'system'
  })
  assert.deepEqual(calls, [{ method: 'getAccountById', id: 'user-1' }])
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
    { method: 'getAccountById', id: 'user-1' },
    { method: 'getAccountById', id: 'user-1' }
  ])
})

test('getUser still reports a missing account', async () => {
  const { service } = createAccountService([])

  await assert.rejects(
    service.getUser('missing-user'),
    error => error.getStatus() === 401 && error.message === 'ACCOUNT_NOT_FOUND'
  )
})

test('current profile selection uses the targeted account mutation', async () => {
  const { service, calls } = createAccountService([
    account({ profiles: ['profile-1', 'profile-2'] })
  ])

  const result = await service.updateCurrentProfile('user-1', 'profile-2')

  assert.equal(result.currentProfile, 'profile-2')
  assert.deepEqual(calls.slice(0, 1), [{
    method: 'changeAccountProfile',
    accountId: 'user-1',
    profileId: 'profile-2',
    action: 'select',
    makeCurrent: true,
    previousCurrentProfileId: null
  }])
})

test('adding a profile persists through the targeted account mutation', async () => {
  const { service, calls } = createAccountService([account()])

  const result = await service.addProfile('user-1', 'profile-2', true)

  assert.deepEqual(result.profiles, ['profile-1', 'profile-2'])
  assert.equal(result.currentProfile, 'profile-2')
  assert.equal(calls[0].method, 'changeAccountProfile')
  assert.equal(calls[0].action, 'add')
})

test('removing the current profile uses the supplied replacement profile', async () => {
  const { service, calls } = createAccountService([
    account({ profiles: ['profile-1', 'profile-2'] })
  ])

  await service.removeProfile('user-1', 'profile-1', 'profile-2')

  assert.deepEqual(calls, [{
    method: 'changeAccountProfile',
    accountId: 'user-1',
    profileId: 'profile-1',
    action: 'remove',
    makeCurrent: false,
    previousCurrentProfileId: 'profile-2'
  }])
})

test('updating preferences uses the targeted account mutation', async () => {
  const { service, calls } = createAccountService([account()])

  assert.deepEqual(await service.updatePreferences('user-1', { theme: 'dark' }), {
    language: 'system',
    theme: 'dark'
  })
  assert.equal(calls[0].method, 'updateAccountPreferences')
})

test('updating preferences preserves the missing-account error', async () => {
  const { service } = createAccountService([])

  await assert.rejects(
    service.updatePreferences('missing-user', { theme: 'dark' }),
    error => error.getStatus() === 401 && error.message === 'ACCOUNT_NOT_FOUND'
  )
})

test('selecting a profile not owned by the account is rejected', async () => {
  const { service } = createAccountService([account()])

  await assert.rejects(
    service.updateCurrentProfile('user-1', 'foreign-profile'),
    error => error.getStatus() === 401 && error.message === 'PROFILE_NOT_OWNED'
  )
})
