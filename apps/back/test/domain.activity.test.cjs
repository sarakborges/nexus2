const test = require('node:test')
const assert = require('node:assert/strict')
const { DomainService } = require('../dist/api/domain/domain.service.js')

function profile(id) {
  return { id, name: id, url: id, picture: '', about: '', type: 'social' }
}

function community(id) {
  return { id, name: id, url: id, picture: '', about: '', type: 'social' }
}

function createService({ ownedProfiles, profiles, communities, relationships, communityRelationships, profilePosts = [], beforeTransaction }) {
  const collections = new Map([
    ['accounts', [{
      id: 'user',
      email: 'user@example.com',
      profiles: [...ownedProfiles],
      currentProfile: ownedProfiles[0] ?? null
    }]],
    ['profiles', profiles],
    ['communities', communities],
    ['relationships', relationships],
    ['community_relationships', communityRelationships],
    ['profile_posts', profilePosts]
  ])
  const data = {
    async read(name) { return structuredClone(collections.get(name) ?? []) },
    async update(name, updater) {
      const next = updater(structuredClone(collections.get(name) ?? []))
      collections.set(name, structuredClone(next))
      return structuredClone(next)
    },
    async transaction(names, updater) {
      beforeTransaction?.(names, collections)
      const snapshot = Object.fromEntries(names.map(name => [
        name,
        structuredClone(collections.get(name) ?? [])
      ]))
      const outcome = updater(snapshot)
      for (const name of names) {
        if (!Array.isArray(outcome.records[name])) throw new Error('INVALID_TRANSACTION_RECORDS')
      }
      for (const name of names) collections.set(name, structuredClone(outcome.records[name]))
      return structuredClone(outcome.result)
    }
  }
  const auth = {
    async getUser() {
      throw new Error('Activity reads must use the account in their repository snapshot')
    },
    async ownsProfile() {
      throw new Error('Activity reads must not perform separate profile ownership reads')
    }
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

test('recent activity normalizes communities in its existing snapshot', async () => {
  let transactionCount = 0
  const service = createService({
    ownedProfiles: ['owned-a'],
    profiles: [profile('owned-a')],
    communities: [community('community-a')],
    relationships: [],
    communityRelationships: [{ profiles: ['owned-a', 'community-a'], type: 'owner', updatedAt: 100 }],
    beforeTransaction(_names, current) {
      transactionCount += 1
      current.set('profiles', [profile('owned-a')])
    }
  })

  const result = await service.getRecentActivity('user')

  assert.equal(result.length, 1)
  assert.equal(transactionCount, 1)
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


test('recent activity does not include relationships after profile ownership is revoked', async () => {
  const service = createService({
    ownedProfiles: ['owned-a'],
    profiles: ['owned-a', 'friend-a'].map(profile),
    communities: [],
    relationships: [
      { profiles: ['owned-a', 'friend-a'], type: 'connection', updatedAt: 100 }
    ],
    communityRelationships: [],
    beforeTransaction(_names, current) {
      current.set('accounts', [{
        id: 'user',
        email: 'user@example.com',
        profiles: [],
        currentProfile: null
      }])
    }
  })

  assert.deepEqual(await service.getRecentActivity('user'), [])
})

test('recent activity includes posts from owned profiles and connected friends', async () => {
  const service = createService({
    ownedProfiles: ['owned-a'],
    profiles: ['owned-a', 'friend-a', 'stranger'].map(profile),
    communities: [],
    relationships: [
      { profiles: ['owned-a', 'friend-a'], type: 'connection', updatedAt: 100 }
    ],
    communityRelationships: [],
    profilePosts: [
      { id: 'own-post', profileId: 'owned-a', content: '<p>Own</p>', createdAt: 600 },
      { id: 'friend-post', profileId: 'friend-a', content: '<p>Friend</p>', createdAt: 500 },
      { id: 'stranger-post', profileId: 'stranger', content: '<p>Hidden</p>', createdAt: 900 }
    ]
  })

  const activity = await service.getRecentActivity('user')
  const posts = activity.filter(item => item.type === 'profile_post')

  assert.deepEqual(posts.map(item => item.id), ['post:own-post', 'post:friend-post'])
  assert.deepEqual(posts.map(item => item.updatedAt), [600, 500])
  assert.ok(!activity.some(item => item.id === 'post:stranger-post'))
})
