const assert = require('node:assert/strict')
const { test } = require('node:test')
const { BadRequestException } = require('@nestjs/common')
const { DomainAccessService } = require('../dist/api/domain/domain-access.service.js')
const { ProfileDirectoryPageService } = require('../dist/api/domain/profile-directory-page.service.js')

const records = {
  profiles: [
    { id: 'profile-target', name: 'Target', url: 'target', picture: '', about: '<p>Target</p>', type: 'social' },
    { id: 'profile-friend', name: 'Friend', url: 'friend', picture: '', about: '<p>Friend</p>', type: 'social' },
    { id: 'profile-other-type', name: 'Other type', url: 'other-type', picture: '', about: '<p>Other</p>', type: 'rp' },
    { id: 'profile-requested', name: 'Requested', url: 'requested', picture: '', about: '', type: 'social' }
  ],
  relationships: [
    { profiles: ['profile-friend', 'profile-target'], type: 'connection', requestedBy: null, blockedBy: null, updatedAt: 100 },
    { profiles: ['profile-other-type', 'profile-target'], type: 'connection', requestedBy: null, blockedBy: null, updatedAt: 90 },
    { profiles: ['profile-requested', 'profile-target'], type: 'requested', requestedBy: 'profile-requested', blockedBy: null, updatedAt: 80 }
  ],
  communities: [
    { id: 'community-public-owner', name: 'Public owner', url: 'public-owner', picture: '', about: '', type: 'social', privacy: 'public' },
    { id: 'community-private', name: 'Private', url: 'private', picture: '', about: '', type: 'social', privacy: 'private' },
    { id: 'community-other-type', name: 'Other type', url: 'other-type-community', picture: '', about: '', type: 'rp', privacy: 'public' },
    { id: 'community-requested', name: 'Requested', url: 'requested-community', picture: '', about: '', type: 'social', privacy: 'public' },
    { id: 'community-member', name: 'Member', url: 'member-community', picture: '', about: '', type: 'social', privacy: 'public' }
  ],
  community_relationships: [
    { profiles: ['profile-target', 'community-public-owner'], type: 'owner', requestedBy: null, blockedBy: null, updatedAt: 200 },
    { profiles: ['profile-target', 'community-private'], type: 'connection', requestedBy: null, blockedBy: null, updatedAt: 190 },
    { profiles: ['profile-other-type', 'community-other-type'], type: 'owner', requestedBy: null, blockedBy: null, updatedAt: 185 },
    { profiles: ['profile-target', 'community-other-type'], type: 'connection', requestedBy: null, blockedBy: null, updatedAt: 180 },
    { profiles: ['profile-target', 'community-requested'], type: 'requested', requestedBy: 'profile-target', blockedBy: null, updatedAt: 170 },
    { profiles: ['profile-target', 'community-member'], type: 'connection', requestedBy: null, blockedBy: null, updatedAt: 160 }
  ]
}

function createRepository(initialRecords = records) {
  let transactionCalls = 0
  return {
    get transactionCalls() { return transactionCalls },
    async transaction(collections, updater) {
      transactionCalls += 1
      assert.deepEqual(collections, [
        'profiles',
        'relationships',
        'communities',
        'community_relationships'
      ])
      const outcome = updater(structuredClone(initialRecords))
      return outcome.result
    }
  }
}

function createService(repository) {
  return new ProfileDirectoryPageService(
    repository,
    new DomainAccessService(repository)
  )
}

function query(overrides = {}) {
  return { page: 1, pageSize: 20, ...overrides }
}

test('friends directory aggregate returns profile and same-type connections in one transaction', async () => {
  const repository = createRepository()
  const service = createService(repository)

  const result = await service.getProfileDirectoryPage(
    '@TARGET',
    'friends',
    query()
  )

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.kind, 'friends')
  assert.equal(result.profile.id, 'profile-target')
  assert.deepEqual(
    result.friends.items.map(profile => profile.id),
    ['profile-friend']
  )
  assert.equal(result.friends.totalItems, 1)
})

test('communities directory aggregate returns active public same-type memberships in one transaction', async () => {
  const repository = createRepository()
  const service = createService(repository)

  const result = await service.getProfileDirectoryPage(
    'target',
    'communities',
    query()
  )

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.kind, 'communities')
  assert.equal(result.profile.id, 'profile-target')
  assert.deepEqual(
    result.communities.items.map(community => community.id),
    ['community-public-owner', 'community-member']
  )
  assert.equal(result.communities.totalItems, 2)
})

test('profile directories preserve pagination', async () => {
  const paginatedRecords = structuredClone(records)
  paginatedRecords.relationships = Array.from({ length: 21 }, (_, index) => ({
    profiles: ['profile-friend-' + index, 'profile-target'],
    type: 'connection',
    requestedBy: null,
    blockedBy: null,
    updatedAt: 1000 - index
  }))
  paginatedRecords.profiles = [
    ...paginatedRecords.profiles,
    ...Array.from({ length: 21 }, (_, index) => ({
      id: 'profile-friend-' + index,
      name: 'Friend ' + index,
      url: 'friend-' + index,
      picture: '',
      about: '',
      type: 'social'
    }))
  ]
  const repository = createRepository(paginatedRecords)
  const service = createService(repository)

  const result = await service.getProfileDirectoryPage(
    'target',
    'friends',
    query({ page: 2 })
  )

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.kind, 'friends')
  assert.equal(result.friends.totalItems, 21)
  assert.deepEqual(
    result.friends.items.map(profile => profile.id),
    ['profile-friend-20']
  )
})

test('unknown profile returns an empty typed directory', async () => {
  const repository = createRepository()
  const service = createService(repository)

  const friends = await service.getProfileDirectoryPage(
    'missing',
    'friends',
    query({ page: 3 })
  )
  const communities = await service.getProfileDirectoryPage(
    'missing',
    'communities',
    query({ page: 3 })
  )

  assert.equal(repository.transactionCalls, 2)
  assert.equal(friends.kind, 'friends')
  assert.equal(friends.profile, null)
  assert.deepEqual(friends.friends.items, [])
  assert.equal(friends.friends.page, 1)
  assert.equal(communities.kind, 'communities')
  assert.equal(communities.profile, null)
  assert.deepEqual(communities.communities.items, [])
  assert.equal(communities.communities.page, 1)
})

test('unsupported directory kind is rejected', async () => {
  const repository = createRepository()
  const service = createService(repository)

  assert.throws(
    () => service.getProfileDirectoryPage('target', 'members', query()),
    error => error instanceof BadRequestException &&
      error.message === 'INVALID_PROFILE_DIRECTORY'
  )
  assert.equal(repository.transactionCalls, 0)
})
