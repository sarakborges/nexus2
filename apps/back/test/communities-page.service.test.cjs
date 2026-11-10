const assert = require('node:assert/strict')
const { test } = require('node:test')
const { UnauthorizedException } = require('@nestjs/common')
const { DomainAccessService } = require('../dist/api/domain/domain-access.service.js')
const { CommunitiesPageService } = require('../dist/api/domain/communities-page.service.js')

const records = {
  accounts: [{
    id: 'user-1',
    email: 'person@example.com',
    profiles: ['profile-1', 'profile-2'],
    currentProfile: 'profile-1',
    password: { hash: 'hash', salt: 'salt' }
  }],
  profiles: [
    { id: 'profile-1', name: 'Primary', url: 'primary', picture: '', about: '<p>Primary</p>', type: 'social' },
    { id: 'profile-2', name: 'Secondary', url: 'secondary', picture: '', about: '<p>Secondary</p>', type: 'rp' },
    { id: 'profile-3', name: 'Owner', url: 'owner', picture: '', about: '', type: 'rp' }
  ],
  communities: [
    { id: 'community-social', name: 'Social', url: 'social', picture: '', about: '<p>Social</p>', type: 'social', privacy: 'public' },
    { id: 'community-rp', name: 'RP', url: 'rp', picture: '', about: '', type: 'social', privacy: 'public' },
    { id: 'community-private', name: 'Private', url: 'private', picture: '', about: '', type: 'social', privacy: 'private' },
    { id: 'community-unlisted', name: 'Unlisted', url: 'unlisted', picture: '', about: '', type: 'social', privacy: 'unlisted' }
  ],
  community_relationships: [
    { profiles: ['profile-1', 'community-social'], type: 'owner', requestedBy: null, blockedBy: null, updatedAt: 10 },
    { profiles: ['profile-3', 'community-rp'], type: 'owner', requestedBy: null, blockedBy: null, updatedAt: 20 },
    { profiles: ['profile-2', 'community-private'], type: 'moderator', requestedBy: null, blockedBy: null, updatedAt: 30 },
    { profiles: ['profile-2', 'community-unlisted'], type: 'owner', requestedBy: null, blockedBy: null, updatedAt: 40 }
  ]
}

function createService(initialRecords = records) {
  let transactionCalls = 0
  const repository = {
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
  const access = new DomainAccessService(repository)
  return { service: new CommunitiesPageService(repository, access), repository }
}

function query(overrides = {}) {
  return { page: 1, pageSize: 20, ...overrides }
}

test('communities page returns active profile and public communities in one transaction', async () => {
  const { service, repository } = createService()
  const result = await service.getCommunitiesPage('user-1', query())

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.currentProfile.id, 'profile-1')
  assert.deepEqual(
    result.communities.items.map((community) => community.id),
    ['community-social', 'community-rp']
  )
  assert.equal(result.communities.totalItems, 2)
  assert.equal(result.communities.items[1].type, 'rp')
  assert.equal(result.currentProfile.about, '<p>Primary</p>')
})

test('communities page falls back to the first owned profile when current profile is unset', async () => {
  const unsetCurrentProfile = structuredClone(records)
  unsetCurrentProfile.accounts[0].currentProfile = null
  const { service } = createService(unsetCurrentProfile)

  const result = await service.getCommunitiesPage('user-1', query())

  assert.equal(result.currentProfile.id, 'profile-1')
})

test('communities page paginates public communities and excludes private and unlisted entries', async () => {
  const paginatedRecords = structuredClone(records)
  paginatedRecords.communities = [
    ...paginatedRecords.communities,
    ...Array.from({ length: 19 }, (_, index) => ({
      id: 'community-' + (index + 3),
      name: 'Community ' + (index + 3),
      url: 'community-' + (index + 3),
      picture: '',
      about: '',
      type: 'social',
      privacy: 'public'
    }))
  ]
  const { service, repository } = createService(paginatedRecords)

  const result = await service.getCommunitiesPage('user-1', query({ page: 2 }))

  assert.equal(repository.transactionCalls, 1)
  assert.deepEqual(result.communities.items.map((community) => community.id), ['community-21'])
  assert.equal(result.communities.totalItems, 21)
  assert.equal(result.communities.page, 2)
})

test('communities page rejects a missing authenticated account', async () => {
  const { service, repository } = createService()

  await assert.rejects(
    service.getCommunitiesPage('missing-user', query()),
    (error) => error instanceof UnauthorizedException && error.message === 'ACCOUNT_NOT_FOUND'
  )
  assert.equal(repository.transactionCalls, 1)
})

test('managed communities includes owner and moderator roles across owned profiles', async () => {
  const { service, repository } = createService()
  const result = await service.getCommunitiesPage('user-1', query({ communityTab: 'managed' }))

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.communityTab, 'managed')
  assert.deepEqual(
    result.communities.items.map(community => community.id),
    ['community-social', 'community-private', 'community-unlisted']
  )
  assert.ok(!result.communities.items.some(community => community.id === 'community-rp'))
})
