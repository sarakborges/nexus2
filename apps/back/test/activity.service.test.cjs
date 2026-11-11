const assert = require('node:assert/strict')
const { test } = require('node:test')
const { DomainAccessService } = require('../dist/api/domain/domain-access.service.js')
const { ActivityService } = require('../dist/api/domain/activity.service.js')

function profile(id) {
  return {
    id,
    name: id,
    url: id,
    picture: '',
    about: '',
    type: 'social',
    createdAt: 1,
    lastActivity: 1
  }
}

function createService(records) {
  let requestedCollections
  const repository = {
    async transaction(collections, updater) {
      requestedCollections = [...collections]
      return updater(structuredClone(records)).result
    }
  }
  const access = new DomainAccessService(repository)
  return {
    service: new ActivityService(repository, access),
    requestedCollections: () => requestedCollections
  }
}

test('loads feed entries from the persisted feed_activities collection', async () => {
  const records = {
    accounts: [{
      id: 'account-1',
      profiles: ['profile-own'],
      currentProfile: 'profile-own'
    }],
    profiles: [profile('profile-own'), profile('profile-friend')],
    communities: [],
    relationships: [{
      profiles: ['profile-friend', 'profile-own'],
      type: 'connection',
      requestedBy: null,
      blockedBy: null,
      updatedAt: 100
    }],
    community_relationships: [],
    profile_posts: [{
      id: 'post-1',
      profileId: 'profile-friend',
      content: '<p>Friend post</p>',
      createdAt: 200
    }],
    profile_settings: [
      {
        profileId: 'profile-own',
        messageAudience: 'everyone',
        publishActivityTypes: ['friend_connected', 'profile_post', 'community_created', 'community_membership'],
        showFriendActivityTypes: ['profile_post']
      },
      {
        profileId: 'profile-friend',
        messageAudience: 'everyone',
        publishActivityTypes: ['profile_post'],
        showFriendActivityTypes: []
      }
    ],
    feed_activities: [{
      id: 'post:post-1',
      type: 'profile_post',
      profileId: 'profile-friend',
      friendId: null,
      communityId: null,
      postId: 'post-1',
      role: null,
      updatedAt: 200
    }]
  }
  const { service, requestedCollections } = createService(records)

  const result = await service.getRecentActivity('account-1')

  assert.deepEqual(result.map(item => item.id), ['post:post-1'])
  assert.equal(result[0].profile.id, 'profile-friend')
  assert.ok(requestedCollections().includes('feed_activities'))
})

test('applies the viewer feed preferences to stored friend activity', async () => {
  const records = {
    accounts: [{
      id: 'account-1',
      profiles: ['profile-own'],
      currentProfile: 'profile-own'
    }],
    profiles: [profile('profile-own'), profile('profile-friend')],
    communities: [],
    relationships: [{
      profiles: ['profile-own', 'profile-friend'],
      type: 'connection',
      requestedBy: null,
      blockedBy: null,
      updatedAt: 100
    }],
    community_relationships: [],
    profile_posts: [{
      id: 'post-1',
      profileId: 'profile-friend',
      content: '<p>Friend post</p>',
      createdAt: 200
    }],
    profile_settings: [{
      profileId: 'profile-own',
      messageAudience: 'everyone',
      publishActivityTypes: ['friend_connected', 'profile_post', 'community_created', 'community_membership'],
      showFriendActivityTypes: []
    }],
    feed_activities: [{
      id: 'post:post-1',
      type: 'profile_post',
      profileId: 'profile-friend',
      friendId: null,
      communityId: null,
      postId: 'post-1',
      role: null,
      updatedAt: 200
    }]
  }
  const { service } = createService(records)

  assert.deepEqual(await service.getRecentActivity('account-1'), [])
})


test('reads relational activity pages with a stable cursor and maps typed rows', async () => {
  let transactionCalled = false
  let readArguments
  const repository = {
    async transaction() {
      transactionCalled = true
      throw new Error('The relational feed must not load collection snapshots.')
    },
    async getActivityFeedRows(userId, limit, cursor) {
      readArguments = { userId, limit, cursor }
      return [
        {
          id: 'post:post-1',
          type: 'profile_post',
          updated_at_ms: 200,
          profile: profile('profile-own'),
          friend: null,
          community: null,
          content: '<p>First page</p>',
          role: null
        },
        {
          id: 'post:post-2',
          type: 'profile_post',
          updated_at_ms: 100,
          profile: profile('profile-own'),
          friend: null,
          community: null,
          content: '<p>Next page</p>',
          role: null
        }
      ]
    }
  }
  const service = new ActivityService(repository, {})

  const page = await service.getRecentActivityPage(
    'account-1',
    1,
    { updatedAt: 300, id: 'cursor-before-feed' }
  )

  assert.equal(transactionCalled, false)
  assert.deepEqual(readArguments, {
    userId: 'account-1',
    limit: 1,
    cursor: { updatedAt: 300, id: 'cursor-before-feed' }
  })
  assert.deepEqual(page.items.map(item => item.id), ['post:post-1'])
  assert.equal(page.items[0].type, 'profile_post')
  assert.equal(page.items[0].content, '<p>First page</p>')
  assert.deepEqual(page.nextCursor, { updatedAt: 200, id: 'post:post-1' })
  assert.equal(page.hasMore, true)
})
