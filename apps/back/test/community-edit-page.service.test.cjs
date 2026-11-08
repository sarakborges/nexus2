const assert = require('node:assert/strict')
const { test } = require('node:test')
const { UnauthorizedException } = require('@nestjs/common')
const { DomainAccessService } = require('../dist/api/domain/domain-access.service.js')
const { CommunityEditPageService } = require('../dist/api/domain/community-edit-page.service.js')

const records = {
  accounts: [{
    id: 'user-1', email: 'person@example.com',
    profiles: ['profile-owner', 'profile-member', 'profile-rp'],
    currentProfile: 'profile-owner', password: { hash: 'hash', salt: 'salt' }
  }],
  profiles: [
    { id: 'profile-owner', name: 'Owner', url: 'owner', picture: '', about: '', type: 'social' },
    { id: 'profile-member', name: 'Member', url: 'member', picture: '', about: '', type: 'social' },
    { id: 'profile-rp', name: 'RP', url: 'rp', picture: '', about: '', type: 'rp' },
    { id: 'profile-other', name: 'Other owner', url: 'other', picture: '', about: '', type: 'social' }
  ],
  communities: [
    { id: 'community-1', name: 'Community', url: 'community', picture: 'https://image.test/picture.png', about: '<p>Description</p>', type: 'social', privacy: 'public' },
    { id: 'community-private', name: 'Private', url: 'private', picture: 'https://image.test/private.png', about: '<p>Private info</p>', type: 'social', privacy: 'private' }
  ],
  community_relationships: [
    { profiles: ['profile-owner', 'community-1'], type: 'owner', requestedBy: null, blockedBy: null, updatedAt: 20 },
    { profiles: ['profile-member', 'community-1'], type: 'connection', requestedBy: null, blockedBy: null, updatedAt: 10 },
    { profiles: ['profile-rp', 'community-1'], type: 'moderator', requestedBy: null, blockedBy: null, updatedAt: 5 },
    { profiles: ['profile-other', 'community-private'], type: 'owner', requestedBy: null, blockedBy: null, updatedAt: 1 }
  ]
}

function createService(initialRecords = records) {
  let transactionCalls = 0
  const repository = {
    get transactionCalls() { return transactionCalls },
    async transaction(collections, updater) {
      transactionCalls += 1
      assert.deepEqual(collections, [
        'accounts', 'profiles', 'communities', 'community_relationships'
      ])
      const outcome = updater(structuredClone(initialRecords))
      return outcome.result
    }
  }
  return {
    service: new CommunityEditPageService(repository, new DomainAccessService(repository)),
    repository
  }
}

test('edit page returns community and authenticated owner profile from one transaction', async () => {
  const { service, repository } = createService()
  const result = await service.getCommunityEditPage('community', 'user-1')
  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.community.id, 'community-1')
  assert.equal(result.ownerProfileId, 'profile-owner')
})

test('edit page does not expose another account owner profile and redacts private community', async () => {
  const { service } = createService()
  const result = await service.getCommunityEditPage('private', 'user-1')
  assert.equal(result.ownerProfileId, null)
  assert.equal(result.community.picture, '')
  assert.equal(result.community.about, '')
})

test('anonymous edit-page visitor receives no owner profile', async () => {
  const { service } = createService()
  const result = await service.getCommunityEditPage('community', null)
  assert.equal(result.community.id, 'community-1')
  assert.equal(result.ownerProfileId, null)
})

test('unknown community returns an empty aggregate and invalid account is rejected', async () => {
  const { service, repository } = createService()
  const missing = await service.getCommunityEditPage('missing', null)
  assert.deepEqual(missing, { community: null, ownerProfileId: null })
  await assert.rejects(
    service.getCommunityEditPage('community', 'missing-user'),
    (error) => error instanceof UnauthorizedException && error.message === 'ACCOUNT_NOT_FOUND'
  )
  assert.equal(repository.transactionCalls, 2)
})
