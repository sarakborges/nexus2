const assert = require('node:assert/strict')
const { test } = require('node:test')
const { DomainAccessService } = require('../dist/api/domain/domain-access.service.js')
const { ActivityService } = require('../dist/api/domain/activity.service.js')
const { HomePageService } = require('../dist/api/domain/home-page.service.js')

test('home page aggregate returns the active profile, previews and suggestions from one transaction', async () => {
  const records = {
    accounts: [{
      id: 'user-1',
      email: 'person@example.com',
      profiles: ['profile-1', 'profile-2'],
      currentProfile: 'profile-1',
      password: { hash: 'hash', salt: 'salt' }
    }],
    profiles: [
      { id: 'profile-1', name: 'Primary', url: 'primary', picture: '', about: '', type: 'social' },
      { id: 'profile-2', name: 'Secondary', url: 'secondary', picture: '', about: '', type: 'social' },
      { id: 'profile-3', name: 'Friend', url: 'friend', picture: '', about: '', type: 'social' },
      { id: 'profile-4', name: 'Other type', url: 'other-type', picture: '', about: '', type: 'rp' }
    ],
    communities: [
      { id: 'community-1', name: 'Joined here', url: 'joined-here', picture: '', about: '', type: 'social', privacy: 'public' },
      { id: 'community-2', name: 'Joined elsewhere', url: 'joined-elsewhere', picture: '', about: '', type: 'social', privacy: 'public' },
      { id: 'community-3', name: 'Suggested', url: 'suggested', picture: '', about: '', type: 'social', privacy: 'public' },
      { id: 'community-4', name: 'Different type', url: 'different-type', picture: '', about: '', type: 'rp', privacy: 'public' },
      { id: 'community-5', name: 'Private', url: 'private', picture: '', about: '', type: 'social', privacy: 'private' }
    ],
    relationships: [{
      profiles: ['profile-1', 'profile-3'],
      type: 'connection',
      requestedBy: null,
      blockedBy: null,
      updatedAt: 100
    }],
    community_relationships: [
      {
        profiles: ['profile-1', 'community-1'],
        type: 'owner',
        requestedBy: null,
        blockedBy: null,
        updatedAt: 200
      },
      {
        profiles: ['profile-2', 'community-2'],
        type: 'connection',
        requestedBy: null,
        blockedBy: null,
        updatedAt: 300
      }
    ]
  }

  let transactionCalls = 0
  const repository = {
    async transaction(collections, updater) {
      transactionCalls += 1
      assert.deepEqual(collections, [
        'accounts',
        'profiles',
        'communities',
        'relationships',
        'community_relationships'
      ])
      const outcome = updater(structuredClone(records))
      return outcome.result
    }
  }
  const access = new DomainAccessService(repository)
  const activity = new ActivityService(repository, access)
  const service = new HomePageService(repository, activity, access)

  const result = await service.getHomePage('user-1')

  assert.equal(transactionCalls, 1)
  assert.equal(result.currentProfile.id, 'profile-1')
  assert.deepEqual(result.friends.items.map(profile => profile.id), ['profile-3'])
  assert.equal(result.friends.totalItems, 1)
  assert.deepEqual(result.communities.items.map(community => community.id), ['community-1'])
  assert.equal(result.communities.totalItems, 1)
  assert.deepEqual(result.suggestions.map(community => community.id), ['community-3'])
  assert.ok(result.activities.some(activity => activity.type === 'friend_connected'))
  assert.ok(result.activities.some(activity =>
    activity.type === 'community_membership' && activity.community.id === 'community-2'
  ))
})
