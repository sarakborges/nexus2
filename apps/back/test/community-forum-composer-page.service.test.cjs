const assert = require('node:assert/strict')
const { test } = require('node:test')
const { UnauthorizedException } = require('@nestjs/common')
const { DomainAccessService } = require('../dist/api/domain/domain-access.service.js')
const { CommunityForumComposerPageService } = require('../dist/api/domain/community-forum-composer-page.service.js')

const records = {
  accounts: [{
    id: 'user-1', email: 'person@example.com',
    profiles: ['profile-member', 'profile-owner', 'profile-rp'],
    currentProfile: 'profile-member',
    password: { hash: 'hash', salt: 'salt' }
  }],
  profiles: [
    { id: 'profile-member', name: 'Member', url: 'member', picture: '', about: '<p>Member</p>', type: 'social' },
    { id: 'profile-owner', name: 'Owner', url: 'owner', picture: '', about: '<p>Owner</p>', type: 'social' },
    { id: 'profile-rp', name: 'RP', url: 'rp', picture: '', about: '', type: 'rp' }
  ],
  communities: [
    { id: 'community-1', name: 'Public', url: 'public', picture: 'https://image.test/public.png', about: '<p>Public info</p>', type: 'social', privacy: 'public' },
    { id: 'community-private', name: 'Private', url: 'private', picture: 'https://image.test/private.png', about: '<p>Private info</p>', type: 'social', privacy: 'private' }
  ],
  community_relationships: [
    { profiles: ['profile-member', 'community-1'], type: 'connection', requestedBy: null, blockedBy: null, updatedAt: 30 },
    { profiles: ['profile-owner', 'community-1'], type: 'owner', requestedBy: null, blockedBy: null, updatedAt: 20 },
    { profiles: ['profile-rp', 'community-1'], type: 'connection', requestedBy: null, blockedBy: null, updatedAt: 10 },
    { profiles: ['profile-owner', 'community-private'], type: 'owner', requestedBy: null, blockedBy: null, updatedAt: 5 }
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
    service: new CommunityForumComposerPageService(
      repository, new DomainAccessService(repository)
    ),
    repository
  }
}

test('composer page selects the current eligible profile and projects the community in one transaction', async () => {
  const { service, repository } = createService()
  const result = await service.getCommunityForumComposerPage('PUBLIC', 'user-1')

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.community.id, 'community-1')
  assert.equal(result.forumProfile.id, 'profile-member')
  assert.equal(result.forumProfile.about, '<p>Member</p>')
  assert.equal(result.currentProfileType, 'social')
  assert.equal(result.viewerRelationship.type, 'connection')
})

test('composer page falls back to owner, then moderator, then first eligible profile', async () => {
  const noCurrent = structuredClone(records)
  noCurrent.accounts[0].currentProfile = null
  const { service } = createService(noCurrent)
  const result = await service.getCommunityForumComposerPage('public', 'user-1')
  assert.equal(result.forumProfile.id, 'profile-owner')
  assert.equal(result.currentProfileType, null)
  assert.equal(result.viewerRelationship, null)
})

test('composer page does not select owned profiles whose type differs from the community', async () => {
  const onlyOtherType = structuredClone(records)
  onlyOtherType.accounts[0].profiles = ['profile-rp']
  onlyOtherType.accounts[0].currentProfile = 'profile-rp'
  const { service } = createService(onlyOtherType)
  const result = await service.getCommunityForumComposerPage('public', 'user-1')
  assert.equal(result.forumProfile, null)
  assert.equal(result.currentProfileType, 'rp')
  assert.equal(result.viewerRelationship.type, 'connection')
})


test('composer preserves an incompatible active profile while choosing another eligible profile only as a fallback', async () => {
  const mismatched = structuredClone(records)
  mismatched.accounts[0].currentProfile = 'profile-rp'
  const { service } = createService(mismatched)
  const result = await service.getCommunityForumComposerPage('public', 'user-1')

  assert.equal(result.currentProfileType, 'rp')
  assert.equal(result.viewerRelationship.type, 'connection')
  assert.equal(result.forumProfile.id, 'profile-owner')
})

test('anonymous composer visitor receives public community data and no posting profile', async () => {
  const { service, repository } = createService()
  const result = await service.getCommunityForumComposerPage('public', null)
  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.community.id, 'community-1')
  assert.equal(result.forumProfile, null)
  assert.equal(result.currentProfileType, null)
  assert.equal(result.viewerRelationship, null)
})

test('private community data is redacted for visitors who are not members', async () => {
  const noPrivateMembership = structuredClone(records)
  noPrivateMembership.community_relationships = noPrivateMembership.community_relationships
    .filter((relationship) => relationship.profiles[1] !== 'community-private')
  const { service } = createService(noPrivateMembership)
  const result = await service.getCommunityForumComposerPage('private', null)
  assert.equal(result.community.id, 'community-private')
  assert.equal(result.community.picture, '')
  assert.equal(result.community.about, '')
})

test('unknown community returns an empty aggregate and invalid account is rejected', async () => {
  const { service, repository } = createService()
  const missing = await service.getCommunityForumComposerPage('missing', null)
  assert.deepEqual(missing, {
    community: null,
    forumProfile: null,
    viewerRelationship: null,
    currentProfileType: null
  })
  await assert.rejects(
    service.getCommunityForumComposerPage('public', 'missing-user'),
    (error) => error instanceof UnauthorizedException && error.message === 'ACCOUNT_NOT_FOUND'
  )
  assert.equal(repository.transactionCalls, 2)
})
