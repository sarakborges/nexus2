const test = require('node:test')
const assert = require('node:assert/strict')
const { AuthService } = require('../dist/api/auth/auth.service.js')

function createAuthHarness() {
  const collections = new Map([
    ['accounts', []],
    ['refresh_tokens', []]
  ])
  const repository = {
    async read(name) { return structuredClone(collections.get(name) ?? []) },
    async update(name, updater) { const next = updater(structuredClone(collections.get(name) ?? [])); collections.set(name, structuredClone(next)); return structuredClone(next) }
  }
  const signedTokens = new Map()
  let tokenCounter = 0
  const jwt = {
    async signAsync(payload) {
      const token = `test-jwt-${++tokenCounter}`
      signedTokens.set(token, structuredClone(payload))
      return token
    },
    async verifyAsync(token) {
      const payload = signedTokens.get(token)
      if (!payload) throw new Error('INVALID_TEST_TOKEN')
      return structuredClone(payload)
    }
  }
  const config = {
    get() { return undefined },
    getOrThrow(key) { return `test-secret-${key}` }
  }
  return {
    service: new AuthService(repository, jwt, config),
    collections
  }
}

test('sign-up normalizes email and never exposes password material', async () => {
  const { service, collections } = createAuthHarness()
  const result = await service.signUp({ email: ' Person@Example.com ', password: 'a-secure-password' })

  assert.equal(result.user.email, 'person@example.com')
  assert.deepEqual(result.user.profiles, [])
  assert.equal(result.user.currentProfile, null)
  assert.equal(Object.hasOwn(result.user, 'password'), false)
  assert.equal(collections.get('accounts').length, 1)
  assert.equal(collections.get('refresh_tokens').length, 1)
})

test('sign-up rejects duplicate emails case-insensitively', async () => {
  const { service } = createAuthHarness()
  await service.signUp({ email: 'person@example.com', password: 'a-secure-password' })

  await assert.rejects(
    service.signUp({ email: ' PERSON@example.com ', password: 'another-secure-password' }),
    error => error.getStatus() === 409 && error.message === 'EMAIL_ALREADY_EXISTS'
  )
})

test('sign-in verifies the password and normalizes the email', async () => {
  const { service } = createAuthHarness()
  await service.signUp({ email: 'person@example.com', password: 'a-secure-password' })

  const result = await service.signIn({ email: ' PERSON@example.com ', password: 'a-secure-password' })
  assert.equal(result.user.email, 'person@example.com')

  await assert.rejects(
    service.signIn({ email: 'person@example.com', password: 'wrong-password' }),
    error => error.getStatus() === 401 && error.message === 'INVALID_CREDENTIALS'
  )
})

test('refresh rotates tokens and rejects replay of the previous token', async () => {
  const { service, collections } = createAuthHarness()
  const initial = await service.signUp({ email: 'person@example.com', password: 'a-secure-password' })

  const rotated = await service.refresh(initial.refreshToken)
  assert.notEqual(rotated.refreshToken, initial.refreshToken)
  assert.equal(collections.get('refresh_tokens').length, 1)

  await assert.rejects(
    service.refresh(initial.refreshToken),
    error => error.getStatus() === 401 && error.message === 'REFRESH_TOKEN_REVOKED'
  )
})

test('a user cannot select a profile that is not linked to their account', async () => {
  const { service } = createAuthHarness()
  const { user } = await service.signUp({ email: 'person@example.com', password: 'a-secure-password' })
  await service.addProfile(user.id, 'profile-owned')

  await assert.rejects(
    service.updateCurrentProfile(user.id, 'profile-owned-by-someone-else'),
    error => error.getStatus() === 401 && error.message === 'PROFILE_NOT_OWNED'
  )
})


test('remove-profile rolls back ownership and restores the previous active profile', async () => {
  const { service } = createAuthHarness()
  const { user } = await service.signUp({ email: 'person@example.com', password: 'a-secure-password' })
  await service.addProfile(user.id, 'profile-first')
  await service.updateCurrentProfile(user.id, 'profile-first')
  await service.addProfile(user.id, 'profile-created-during-transaction')
  await service.removeProfile(user.id, 'profile-created-during-transaction', 'profile-first')

  const updated = await service.getUser(user.id)
  assert.deepEqual(updated.profiles, ['profile-first'])
  assert.equal(updated.currentProfile, 'profile-first')
})


test('concurrent refresh requests rotate a refresh token only once', async () => {
  const { service, collections } = createAuthHarness()
  const initial = await service.signUp({ email: 'race@example.com', password: 'a-secure-password' })

  const results = await Promise.allSettled([
    service.refresh(initial.refreshToken),
    service.refresh(initial.refreshToken)
  ])

  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(results.filter(result => result.status === 'rejected').length, 1)
  const rejection = results.find(result => result.status === 'rejected')
  assert.equal(rejection.reason.getStatus(), 401)
  assert.equal(rejection.reason.message, 'REFRESH_TOKEN_REVOKED')
  assert.equal(collections.get('refresh_tokens').length, 1)
})

test('concurrent sign-ups cannot create duplicate normalized emails', async () => {
  const { service, collections } = createAuthHarness()
  const results = await Promise.allSettled([
    service.signUp({ email: 'same@example.com', password: 'a-secure-password' }),
    service.signUp({ email: ' SAME@example.com ', password: 'another-secure-password' })
  ])

  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(results.filter(result => result.status === 'rejected').length, 1)
  assert.equal(collections.get('accounts').length, 1)
})
