const test = require('node:test')
const assert = require('node:assert/strict')
const { AuthService } = require('../dist/api/auth/auth.service.js')

function createAuthHarness({ failTransaction = false } = {}) {
  const collections = new Map([
    ['accounts', []],
    ['refresh_tokens', []]
  ])
  const accounts = collections.get('accounts')
  const refreshTokens = collections.get('refresh_tokens')
  const repository = {
    async getAccountById(id) {
      return structuredClone(accounts.find(account => account.id === id) ?? null)
    },
    async findAccountByEmail(email) {
      return structuredClone(accounts.find(account => account.email === email) ?? null)
    },
    async createAccountWithRefreshToken(change) {
      if (failTransaction) throw new Error('TRANSACTION_FAILED')
      if (accounts.some(account => account.email === change.email)) {
        throw new Error('EMAIL_ALREADY_EXISTS')
      }
      accounts.push({
        id: change.accountId,
        email: change.email,
        password: { hash: change.passwordHash, salt: change.passwordSalt },
        profiles: [],
        currentProfile: null
      })
      refreshTokens.push(structuredClone(change.refreshToken))
    },
    async issueRefreshToken(record, rotation, now) {
      if (rotation) {
        const previous = refreshTokens.find(item =>
          item.id === rotation.id &&
          item.userId === rotation.userId &&
          item.tokenHash === rotation.tokenHash &&
          item.expiresAt > now
        )
        if (!previous) throw new Error('REFRESH_TOKEN_REVOKED')
      }
      const next = refreshTokens
        .filter(item => item.expiresAt > now && (!rotation || item.id !== rotation.id))
      next.push(structuredClone(record))
      collections.set('refresh_tokens', next)
    },
    async deleteRefreshTokenByHash(hash) {
      collections.set('refresh_tokens', refreshTokens.filter(item => item.tokenHash !== hash))
    },
    async changeAccountProfile(change) {
      const account = accounts.find(item => item.id === change.accountId)
      if (!account) throw new Error('ACCOUNT_NOT_FOUND')
      let profiles = [...account.profiles]
      let currentProfile = account.currentProfile
      if (change.action === 'add') {
        if (!profiles.includes(change.profileId)) profiles.push(change.profileId)
        if (change.makeCurrent || !currentProfile) currentProfile = change.profileId
      } else if (change.action === 'select') {
        if (!profiles.includes(change.profileId)) throw new Error('PROFILE_NOT_OWNED')
        currentProfile = change.profileId
      } else {
        if (!profiles.includes(change.profileId)) return
        profiles = profiles.filter(id => id !== change.profileId)
        if (currentProfile === change.profileId) {
          currentProfile = change.previousCurrentProfileId && profiles.includes(change.previousCurrentProfileId)
            ? change.previousCurrentProfileId
            : profiles[0] ?? null
        }
      }
      Object.assign(account, { profiles, currentProfile })
    },
    async updateAccountPreferences(userId, preferences) {
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
    collections,
    repository
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

test('refresh reads only the account identified by the signed token', async () => {
  const { service, repository } = createAuthHarness()
  const initial = await service.signUp({ email: 'selective@example.com', password: 'a-secure-password' })

  const lookups = []
  const originalLookup = repository.getAccountById
  repository.getAccountById = async id => {
    lookups.push(id)
    return originalLookup(id)
  }

  await service.refresh(initial.refreshToken)

  assert.deepEqual(lookups, [initial.user.id])
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

test('sign-up does not persist an account when initial refresh-token persistence fails', async () => {
  const { service, collections } = createAuthHarness({ failTransaction: true })

  await assert.rejects(
    service.signUp({ email: 'atomic@example.com', password: 'a-secure-password' }),
    /TRANSACTION_FAILED/
  )

  assert.deepEqual(collections.get('accounts'), [])
  assert.deepEqual(collections.get('refresh_tokens'), [])
})



test('sign-in uses the targeted account lookup instead of loading the accounts collection', async () => {
  const { service, repository } = createAuthHarness()
  await service.signUp({ email: 'targeted@example.com', password: 'a-secure-password' })

  const lookups = []
  const originalLookup = repository.findAccountByEmail
  repository.findAccountByEmail = async email => {
    lookups.push(email)
    return originalLookup(email)
  }

  const result = await service.signIn({
    email: ' TARGETED@example.com ',
    password: 'a-secure-password'
  })

  assert.equal(result.user.email, 'targeted@example.com')
  assert.deepEqual(lookups, ['targeted@example.com'])
})


test('refresh rotation uses the relational atomic token writer instead of a collection update', async () => {
  const { service, repository } = createAuthHarness()
  const initial = await service.signUp({ email: 'relational-refresh@example.com', password: 'a-secure-password' })
  const rotations = []
  repository.issueRefreshToken = async (record, rotation, now) => {
    rotations.push({ record, rotation, now })
  }
  repository.update = async () => {
    throw new Error('Relational refresh rotation must not read or rewrite a collection snapshot.')
  }

  const result = await service.refresh(initial.refreshToken)

  assert.notEqual(result.refreshToken, initial.refreshToken)
  assert.equal(rotations.length, 1)
  assert.equal(rotations[0].record.userId, initial.user.id)
  assert.match(rotations[0].record.id, /^[0-9a-f-]{36}$/)
  assert.equal(rotations[0].record.tokenHash.length, 64)
  assert.ok(rotations[0].rotation)
  assert.match(rotations[0].rotation.id, /^[0-9a-f-]{36}$/)
  assert.equal(rotations[0].rotation.userId, initial.user.id)
  assert.equal(rotations[0].rotation.tokenHash.length, 64)
  assert.ok(rotations[0].now > 0)
})

test('sign-out revokes a refresh token by its stored hash without collection updates', async () => {
  const { service, repository } = createAuthHarness()
  const initial = await service.signUp({ email: 'relational-signout@example.com', password: 'a-secure-password' })
  let revokedHash
  repository.deleteRefreshTokenByHash = async hash => { revokedHash = hash }
  repository.update = async () => {
    throw new Error('Relational sign-out must not read or rewrite a collection snapshot.')
  }

  await service.signOut(initial.refreshToken)

  assert.equal(typeof revokedHash, 'string')
  assert.equal(revokedHash.length, 64)
  assert.notEqual(revokedHash, initial.refreshToken)
})


test('account profile changes use targeted relational writes instead of account collection snapshots', async () => {
  const { service, collections, repository } = createAuthHarness()
  const { user } = await service.signUp({
    email: 'relational-profiles@example.com',
    password: 'a-secure-password'
  })
  const changes = []
  repository.changeAccountProfile = async change => {
    changes.push(change)
    const accounts = collections.get('accounts')
    const index = accounts.findIndex(account => account.id === change.accountId)
    if (index < 0) throw new Error('ACCOUNT_NOT_FOUND')
    const account = accounts[index]
    let profiles = [...account.profiles]
    let currentProfile = account.currentProfile
    if (change.action === 'add') {
      if (!profiles.includes(change.profileId)) profiles.push(change.profileId)
      if (change.makeCurrent || !currentProfile) currentProfile = change.profileId
    } else if (change.action === 'select') {
      if (!profiles.includes(change.profileId)) throw new Error('PROFILE_NOT_OWNED')
      currentProfile = change.profileId
    } else {
      if (!profiles.includes(change.profileId)) return
      profiles = profiles.filter(id => id !== change.profileId)
      if (currentProfile === change.profileId) {
        currentProfile = change.previousCurrentProfileId && profiles.includes(change.previousCurrentProfileId)
          ? change.previousCurrentProfileId
          : profiles[0] ?? null
      }
    }
    accounts[index] = { ...account, profiles, currentProfile }
    collections.set('accounts', accounts)
  }
  repository.update = async () => {
    throw new Error('Relational account-profile changes must not update full collection snapshots.')
  }

  await service.addProfile(user.id, 'profile-1', true)
  await service.addProfile(user.id, 'profile-2')
  const selected = await service.updateCurrentProfile(user.id, 'profile-2')
  await service.removeProfile(user.id, 'profile-2', 'profile-1')
  const finalUser = await service.getUser(user.id)

  assert.deepEqual(selected.profiles, ['profile-1', 'profile-2'])
  assert.equal(selected.currentProfile, 'profile-2')
  assert.deepEqual(finalUser.profiles, ['profile-1'])
  assert.equal(finalUser.currentProfile, 'profile-1')
  assert.deepEqual(changes.map(change => change.action), ['add', 'add', 'select', 'remove'])
})
