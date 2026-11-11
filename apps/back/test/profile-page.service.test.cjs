const assert = require('node:assert/strict')
const { test } = require('node:test')
const { DomainAccessService } = require('../dist/api/domain/domain-access.service.js')
const { ProfilePageService } = require('../dist/api/domain/profile-page.service.js')

const records = {
  accounts: [{ id: 'viewer-user', profiles: ['profile-2'], currentProfile: 'profile-2' }],
  profiles: [
    { id: 'profile-1', name: 'Viewed', url: 'viewed', picture: '', about: '', type: 'social' },
    { id: 'profile-2', name: 'Friend', url: 'friend', picture: '', about: '', type: 'social' },
    { id: 'profile-3', name: 'Different type', url: 'different-type', picture: '', about: '', type: 'rp' }
  ],
  relationships: [
    {
      profiles: ['profile-1', 'profile-2'],
      type: 'connection',
      requestedBy: null,
      blockedBy: null,
      updatedAt: 100
    },
    {
      profiles: ['profile-1', 'profile-3'],
      type: 'connection',
      requestedBy: null,
      blockedBy: null,
      updatedAt: 100
    }
  ],
  communities: [
    { id: 'community-1', name: 'Public member', url: 'public-member', picture: '', about: '', type: 'social', privacy: 'public' },
    { id: 'community-2', name: 'Private member', url: 'private-member', picture: '', about: '', type: 'social', privacy: 'private' },
    { id: 'community-3', name: 'Not a member', url: 'not-a-member', picture: '', about: '', type: 'social', privacy: 'public' },
    { id: 'community-4', name: 'Different type', url: 'different-type-community', picture: '', about: '', type: 'rp', privacy: 'public' }
  ],
  community_relationships: [
    {
      profiles: ['profile-1', 'community-1'],
      type: 'owner',
      requestedBy: null,
      blockedBy: null,
      updatedAt: 100
    },
    {
      profiles: ['profile-1', 'community-2'],
      type: 'connection',
      requestedBy: null,
      blockedBy: null,
      updatedAt: 100
    },
    {
      profiles: ['profile-3', 'community-4'],
      type: 'owner',
      requestedBy: null,
      blockedBy: null,
      updatedAt: 100
    },
    {
      profiles: ['profile-1', 'community-4'],
      type: 'connection',
      requestedBy: null,
      blockedBy: null,
      updatedAt: 100
    }
  ]
}

test('profile page aggregate returns profile, friend and community previews from one transaction', async () => {
  let transactionCalls = 0
  const repository = {
    async transaction(collections, updater) {
      transactionCalls += 1
      assert.deepEqual(collections, [
        'accounts',
        'profiles',
        'relationships',
        'communities',
        'community_relationships'
      ])
      const outcome = updater(structuredClone(records))
      return outcome.result
    }
  }
  const access = new DomainAccessService(repository)
  const service = new ProfilePageService(repository, access)

  const result = await service.getProfilePage('@VIEWED', 'viewer-user')

  assert.equal(transactionCalls, 1)
  assert.equal(result.profile.id, 'profile-1')
  assert.equal(result.viewerRelationship.type, 'connection')
  assert.equal(result.currentProfileType, 'social')
  assert.deepEqual(result.friends.items.map(profile => profile.id), ['profile-2'])
  assert.equal(result.friends.totalItems, 1)
  assert.deepEqual(
    result.communities.items.map(community => community.id),
    ['community-1']
  )
  assert.equal(result.communities.totalItems, 1)
})

test('profile page aggregate returns empty previews when the profile does not exist', async () => {
  let transactionCalls = 0
  const repository = {
    async transaction(_collections, updater) {
      transactionCalls += 1
      return updater(structuredClone(records)).result
    }
  }
  const access = new DomainAccessService(repository)
  const service = new ProfilePageService(repository, access)

  const result = await service.getProfilePage('missing-profile', null)

  assert.equal(transactionCalls, 1)
  assert.equal(result.profile, null)
  assert.equal(result.viewerRelationship, null)
  assert.equal(result.currentProfileType, null)
  assert.deepEqual(result.friends.items, [])
  assert.deepEqual(result.communities.items, [])
})


test('profile page uses a targeted relational read and sanitizes profile and friend about fields', async () => {
  const calls = []
  const result = {
    profile: {
      id: 'profile-1', name: 'Profile', url: 'profile', picture: '',
      about: '<p>About</p><script>unsafe()</script>', type: 'social',
      createdAt: 1, lastActivity: 2
    },
    viewerRelationship: null,
    currentProfileType: 'social',
    friends: {
      items: [{
        id: 'profile-2', name: 'Friend', url: 'friend', picture: '',
        about: '<p>Friend</p><script>unsafe()</script>', type: 'social',
        createdAt: 1, lastActivity: 2
      }],
      page: 1, pageSize: 20, totalItems: 1, totalPages: 1
    },
    communities: {
      items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 1
    }
  }
  const repository = {
    async getProfilePage(url, userId) {
      calls.push({ url, userId })
      return result
    },
    async transaction() {
      throw new Error('Profile page reads must not load collection snapshots.')
    }
  }
  const service = new ProfilePageService(repository, {})

  const page = await service.getProfilePage('@PROFILE', 'account-1')

  assert.deepEqual(calls, [{ url: 'profile', userId: 'account-1' }])
  assert.equal(page.profile.about.includes('<script>'), false)
  assert.equal(page.friends.items[0].about.includes('<script>'), false)
})
