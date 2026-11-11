const assert = require('node:assert/strict')
const { test } = require('node:test')
const { UnauthorizedException } = require('@nestjs/common')
const { ProfileEditPageService } = require('../dist/api/domain/profile-edit-page.service.js')

const records = {
  accounts: [{
    id: 'user-1',
    email: 'person@example.com',
    profiles: ['profile-owner', 'profile-other-type'],
    currentProfile: 'profile-owner',
    password: { hash: 'hash', salt: 'salt' }
  }],
  profiles: [
    { id: 'profile-owner', name: 'Owner', url: 'owner', picture: '', about: '<p>Owner</p>', type: 'social' },
    { id: 'profile-other-type', name: 'RP', url: 'rp', picture: '', about: '<p>RP</p>', type: 'rp' },
    { id: 'profile-target', name: 'Target', url: 'target', picture: '', about: '<p>Target</p><script>alert(1)</script>', type: 'social' }
  ]
}

function createService(initialRecords = records) {
  let transactionCalls = 0
  const repository = {
    get transactionCalls() { return transactionCalls },
    async transaction(collections, updater) {
      transactionCalls += 1
      assert.deepEqual(collections, ['accounts', 'profiles'])
      return updater(structuredClone(initialRecords)).result
    }
  }
  return { service: new ProfileEditPageService(repository), repository }
}

test('profile edit page returns target and active profile type from one transaction', async () => {
  const { service, repository } = createService()
  const result = await service.getProfileEditPage('@TARGET', 'user-1')
  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.profile.id, 'profile-target')
  assert.equal(result.currentProfileType, 'social')
  assert.equal(result.profile.about.includes('<script>'), false)
})

test('profile edit page returns no active profile type for an account without a selected owned profile', async () => {
  const noActiveProfile = structuredClone(records)
  noActiveProfile.accounts[0].currentProfile = null
  const { service } = createService(noActiveProfile)
  const result = await service.getProfileEditPage('target', 'user-1')
  assert.equal(result.currentProfileType, null)
})

test('profile edit page does not resolve a stale active profile outside the account profile list', async () => {
  const staleActiveProfile = structuredClone(records)
  staleActiveProfile.accounts[0].currentProfile = 'profile-other-type'
  staleActiveProfile.accounts[0].profiles = ['profile-owner']
  const { service } = createService(staleActiveProfile)
  const result = await service.getProfileEditPage('target', 'user-1')
  assert.equal(result.currentProfileType, null)
})

test('anonymous profile edit page returns public profile data without active profile type', async () => {
  const { service, repository } = createService()
  const result = await service.getProfileEditPage('target', null)
  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.profile.id, 'profile-target')
  assert.equal(result.currentProfileType, null)
})

test('unknown profile returns an empty aggregate and invalid account is rejected', async () => {
  const { service, repository } = createService()
  const missing = await service.getProfileEditPage('missing', null)
  assert.deepEqual(missing, { profile: null, currentProfileType: null })
  await assert.rejects(
    service.getProfileEditPage('target', 'missing-user'),
    (error) => error instanceof UnauthorizedException && error.message === 'ACCOUNT_NOT_FOUND'
  )
  assert.equal(repository.transactionCalls, 2)
})


test('profile edit page uses a targeted relational read', async () => {
  const repository = {
    async getProfileEditPage(url, userId) {
      assert.equal(url, 'target')
      assert.equal(userId, 'user-1')
      return {
        profile: { id: 'profile-target', about: '<p>Target</p><script>unsafe()</script>' },
        currentProfileType: 'social'
      }
    },
    async transaction() { throw new Error('Profile edit page must not load collection snapshots.') }
  }
  const service = new ProfileEditPageService(repository)
  const result = await service.getProfileEditPage('@TARGET', 'user-1')
  assert.equal(result.profile.about.includes('<script>'), false)
})
