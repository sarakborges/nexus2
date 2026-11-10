const assert = require('node:assert/strict')
const { test } = require('node:test')
const { DomainAccessService } = require('../dist/api/domain/domain-access.service.js')
const { CommunityMembersPageService } = require('../dist/api/domain/community-members-page.service.js')

const records = {
  accounts: [{
    id: 'viewer-1',
    email: 'viewer@example.com',
    profiles: ['profile-owner', 'profile-moderator', 'profile-member'],
    currentProfile: 'profile-member',
    password: { hash: 'hash', salt: 'salt' }
  }],
  profiles: [
    { id: 'profile-owner', name: 'Owner', url: 'owner', picture: '', about: '', type: 'social' },
    { id: 'profile-moderator', name: 'Moderator', url: 'moderator', picture: '', about: '', type: 'social' },
    { id: 'profile-member', name: 'Member', url: 'member', picture: '', about: '', type: 'social' },
    { id: 'profile-other-member', name: 'Other member', url: 'other-member', picture: '', about: '', type: 'social' },
    { id: 'profile-pending', name: 'Pending', url: 'pending', picture: '', about: '', type: 'social' },
    { id: 'profile-blocked', name: 'Blocked', url: 'blocked', picture: '', about: '', type: 'social' },
    { id: 'profile-other-type', name: 'Other type', url: 'other-type', picture: '', about: '', type: 'rp' }
  ],
  communities: [
    { id: 'community-1', name: 'Community', url: 'community', picture: '/picture.png', about: '<p>About</p>', type: 'social', privacy: 'public' }
  ],
  community_relationships: [
    { profiles: ['profile-owner', 'community-1'], type: 'owner', requestedBy: null, blockedBy: null, updatedAt: 600 },
    { profiles: ['profile-moderator', 'community-1'], type: 'moderator', requestedBy: null, blockedBy: null, updatedAt: 500 },
    { profiles: ['profile-member', 'community-1'], type: 'connection', requestedBy: null, blockedBy: null, updatedAt: 400 },
    { profiles: ['profile-other-member', 'community-1'], type: 'connection', requestedBy: null, blockedBy: null, updatedAt: 300 },
    { profiles: ['profile-pending', 'community-1'], type: 'requested', requestedBy: 'profile-pending', blockedBy: null, updatedAt: 200 },
    { profiles: ['profile-blocked', 'community-1'], type: 'blocked', requestedBy: null, blockedBy: 'profile-owner', updatedAt: 100 },
    { profiles: ['profile-other-type', 'community-1'], type: 'blocked', requestedBy: null, blockedBy: 'profile-other-type', updatedAt: 50 }
  ]
}

function createRepository(initialRecords = records) {
  let transactionCalls = 0
  return {
    get transactionCalls() { return transactionCalls },
    async transaction(collections, updater) {
      transactionCalls += 1
      assert.deepEqual(collections, [
        'accounts',
        'profiles',
        'communities',
        'community_relationships'
      ])
      const outcome = updater(structuredClone(initialRecords))
      return outcome.result
    }
  }
}

function createService(repository) {
  return new CommunityMembersPageService(
    repository,
    new DomainAccessService(repository)
  )
}

function query(overrides = {}) {
  return {
    page: 1,
    pageSize: 20,
    pendingPage: 1,
    tab: 'all',
    ...overrides
  }
}

test('community members page aggregate returns directory, pending requests and management access in one transaction', async () => {
  const repository = createRepository()
  const service = createService(repository)

  const result = await service.getCommunityMembersPage(
    'community',
    query(),
    'viewer-1'
  )

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.community.id, 'community-1')
  assert.equal(result.viewerRelationship.type, 'connection')
  assert.equal(result.currentProfileType, 'social')
  assert.deepEqual(
    result.relationships.map(relationship => relationship.type),
    ['owner', 'moderator', 'connection']
  )
  assert.equal(result.actorProfileId, 'profile-owner')
  assert.equal(result.actorRole, 'owner')
  assert.equal(result.isStaff, true)
  assert.equal(result.visibleTab, 'all')
  assert.deepEqual(
    result.members.items.map(profile => profile.id),
    ['profile-owner', 'profile-moderator', 'profile-member', 'profile-other-member']
  )
  assert.equal(result.members.totalItems, 4)
  assert.deepEqual(result.pending.items.map(profile => profile.id), ['profile-pending'])
  assert.equal(result.pending.totalItems, 1)
  assert.equal(result.pending.items[0].role, 'requested')
})

test('staff and banned tabs return only their matching membership roles', async () => {
  const repository = createRepository()
  const service = createService(repository)

  const staff = await service.getCommunityMembersPage(
    'community',
    query({ tab: 'staff' }),
    'viewer-1'
  )
  const banned = await service.getCommunityMembersPage(
    'community',
    query({ tab: 'banned' }),
    'viewer-1'
  )

  assert.equal(repository.transactionCalls, 2)
  assert.equal(staff.visibleTab, 'staff')
  assert.deepEqual(
    staff.members.items.map(profile => profile.id),
    ['profile-owner', 'profile-moderator']
  )
  assert.equal(banned.visibleTab, 'banned')
  assert.deepEqual(
    banned.members.items.map(profile => profile.id),
    ['profile-blocked']
  )
})

test('non-staff viewers are limited to the all-members tab and cannot see pending requests', async () => {
  const memberRecords = structuredClone(records)
  memberRecords.accounts[0].profiles = ['profile-member']
  memberRecords.accounts[0].currentProfile = 'profile-member'
  const repository = createRepository(memberRecords)
  const service = createService(repository)

  const result = await service.getCommunityMembersPage(
    'community',
    query({ tab: 'staff' }),
    'viewer-1'
  )

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.isStaff, false)
  assert.equal(result.actorProfileId, null)
  assert.equal(result.visibleTab, 'all')
  assert.equal(result.members.totalItems, 4)
  assert.deepEqual(result.pending.items, [])
  assert.equal(result.pending.totalItems, 0)
})

test('public community members can be viewed anonymously without management controls', async () => {
  const repository = createRepository()
  const service = createService(repository)

  const result = await service.getCommunityMembersPage(
    'community',
    query(),
    null
  )

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.isStaff, false)
  assert.deepEqual(result.relationships, [])
  assert.equal(result.viewerRelationship, null)
  assert.equal(result.currentProfileType, null)
  assert.equal(result.members.totalItems, 4)
  assert.equal(result.pending.totalItems, 0)
})

test('private community member directory hides the resource from non-members', async () => {
  const privateRecords = structuredClone(records)
  privateRecords.communities[0].privacy = 'private'
  privateRecords.accounts[0].profiles = []
  privateRecords.accounts[0].currentProfile = null
  const repository = createRepository(privateRecords)
  const service = createService(repository)

  await assert.rejects(
    () => service.getCommunityMembersPage(
      'community',
      query(),
      'viewer-1'
    ),
    error => error.getStatus() === 404 && error.message === 'COMMUNITY_NOT_FOUND'
  )
  assert.equal(repository.transactionCalls, 1)
})

test('unknown community returns empty paginated member and pending lists', async () => {
  const repository = createRepository()
  const service = createService(repository)

  const result = await service.getCommunityMembersPage(
    'missing',
    query({ page: 4, pendingPage: 3 }),
    'viewer-1'
  )

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.community, null)
  assert.equal(result.members.items.length, 0)
  assert.equal(result.members.page, 1)
  assert.equal(result.pending.items.length, 0)
  assert.equal(result.pending.page, 1)
})
