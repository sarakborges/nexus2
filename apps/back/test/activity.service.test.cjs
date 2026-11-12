const assert = require('node:assert/strict')
const { test } = require('node:test')
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

test('activity page reads typed feed rows with a stable keyset cursor', async () => {
  let args
  const repository = {
    async getActivityFeedRows(userId, limit, cursor) {
      args = { userId, limit, cursor }
      return [
        {
          id: 'post:1', type: 'profile_post', updated_at_ms: 200,
          profile: profile('profile-own'), friend: null, community: null,
          content: '<p>First page</p><script>unsafe()</script>', role: null
        },
        {
          id: 'post:2', type: 'profile_post', updated_at_ms: 100,
          profile: profile('profile-own'), friend: null, community: null,
          content: '<p>Next page</p>', role: null
        }
      ]
    }
  }
  const service = new ActivityService(repository)
  const page = await service.getRecentActivityPage(
    'account-1', 1, { updatedAt: 300, id: 'cursor-before-feed' }
  )
  assert.deepEqual(args, {
    userId: 'account-1',
    limit: 1,
    cursor: { updatedAt: 300, id: 'cursor-before-feed' }
  })
  assert.equal(page.items.length, 1)
  assert.equal(page.items[0].content, '<p>First page</p>')
  assert.deepEqual(page.nextCursor, { updatedAt: 200, id: 'post:1' })
  assert.equal(page.hasMore, true)
})

test('activity page maps all typed feed variants', async () => {
  const friend = profile('friend')
  const community = { id: 'community-1', name: 'Community', url: 'community' }
  const repository = {
    async getActivityFeedRows() {
      return [
        {
          id: 'friend:1', type: 'friend_connected', updated_at_ms: 400,
          profile: profile('profile-1'), friend, community: null, content: null, role: null
        },
        {
          id: 'post:1', type: 'profile_post', updated_at_ms: 300,
          profile: profile('profile-1'), friend: null, community: null, content: '<p>Post</p>', role: null
        },
        {
          id: 'community:1', type: 'community_created', updated_at_ms: 200,
          profile: profile('profile-1'), friend: null, community, content: null, role: null
        },
        {
          id: 'membership:1', type: 'community_membership', updated_at_ms: 100,
          profile: profile('profile-1'), friend: null, community, content: null, role: 'moderator'
        }
      ]
    }
  }
  const service = new ActivityService(repository)
  const page = await service.getRecentActivityPage('account-1', 10)
  assert.deepEqual(page.items.map(item => item.type), [
    'friend_connected', 'profile_post', 'community_created', 'community_membership'
  ])
  assert.equal(page.items[0].friend.id, 'friend')
  assert.equal(page.items[2].community.id, 'community-1')
  assert.equal(page.items[3].role, 'moderator')
  assert.equal(page.hasMore, false)
  assert.equal(page.nextCursor, null)
})

test('getRecentActivity pages through relational feed rows without collection snapshots', async () => {
  const calls = []
  const rows = Array.from({ length: 51 }, (_, index) => ({
    id: 'post:' + index,
    type: 'profile_post',
    updated_at_ms: 1000 - index,
    profile: profile('profile-1'),
    friend: null,
    community: null,
    content: '<p>Post</p>',
    role: null
  }))
  const repository = {
    async getActivityFeedRows(userId, limit, cursor) {
      calls.push({ userId, limit, cursor })
      return cursor ? rows.slice(50) : rows
    }
  }
  const service = new ActivityService(repository)
  const items = await service.getRecentActivity('account-1')
  assert.equal(items.length, 51)
  assert.deepEqual(calls, [
    { userId: 'account-1', limit: 51, cursor: null },
    { userId: 'account-1', limit: 51, cursor: { updatedAt: 951, id: 'post:49' } }
  ])
})
