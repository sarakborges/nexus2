const test = require('node:test')
const assert = require('node:assert/strict')
const { DomainService } = require('../dist/api/domain/domain.service.js')

function profile(id) {
  return { id, name: id, url: id, picture: '', about: '', type: 'social' }
}

function community(id) {
  return { id, name: id, url: id, picture: '', about: '', type: 'social' }
}

function createService({ ownedProfiles, profiles, communities, relationships, communityRelationships }) {
  const collections = new Map([
    ['profiles', profiles],
    ['communities', communities],
    ['relationships', relationships],
    ['community_relationships', communityRelationships]
  ])
  const data = {
    async read(name) { return structuredClone(collections.get(name) ?? []) },
    async write(name, records) { collections.set(name, structuredClone(records)) }
  }
  const auth = {
    async getUser(userId) {
      return { id: userId, email: 'user@example.com', profiles: ownedProfiles, currentProfile: ownedProfiles[0] ?? null }
    },
    async ownsProfile(userId, profileId) { return ownedProfiles.includes(profileId) }
  }
  return new DomainService(data, auth)
}

test('recent activity merges friend and community updates for all owned profiles', async () => {
  const service = createService({
    ownedProfiles: ['owned-a', 'owned-b'],
    profiles: ['owned-a', 'owned-b', 'friend-a', 'friend-b', 'other-a', 'other-b'].map(profile),
    communities: ['community-a', 'community-b'].map(community),
    relationships: [
      { profiles: ['owned-a', 'friend-a'], type: 'connection', updatedAt: 100 },
      { profiles: ['friend-b', 'owned-b'], type: 'connection', updatedAt: 200 },
      { profiles: ['owned-a', 'other-a'], type: 'blocked', updatedAt: 900 },
      { profiles: ['other-a', 'other-b'], type: 'connection', updatedAt: 1000 },
      { profiles: ['owned-a', 'owned-b'], type: 'connection', updatedAt: 1100 }
    ],
    communityRelationships: [
      { profiles: ['owned-a', 'community-a'], type: 'owner', updatedAt: 300 },
      { profiles: ['owned-b', 'community-b'], type: 'connection', updatedAt: 400 },
      { profiles: ['owned-a', 'community-b'], type: 'requested', updatedAt: 800 },
      { profiles: ['owned-b', 'community-a'], type: 'blocked', updatedAt: 700 }
    ]
  })

  const activity = await service.getRecentActivity('user')

  assert.deepEqual(activity.map(item => item.updatedAt), [400, 300, 200, 100])
  assert.deepEqual(activity.map(item => item.type), [
    'community_membership',
    'community_membership',
    'friend_connected',
    'friend_connected'
  ])
  assert.equal(activity[0].community.id, 'community-b')
  assert.equal(activity[2].friend.id, 'friend-b')
})

test('recent activity returns an empty list when the account has no profiles', async () => {
  const service = createService({
    ownedProfiles: [],
    profiles: [],
    communities: [],
    relationships: [],
    communityRelationships: []
  })

  assert.deepEqual(await service.getRecentActivity('user'), [])
})
