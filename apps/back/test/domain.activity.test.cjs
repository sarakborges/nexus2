const test = require('node:test')
const assert = require('node:assert/strict')
const { DomainService } = require('../dist/api/domain/domain.service.js')

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

test('DomainService retrieves recent activity only from relational feed rows', async () => {
  let calls = 0
  const community = {
    id: 'community-1',
    name: 'Community',
    url: 'community',
    picture: '',
    about: '',
    type: 'social'
  }
  const repository = {
    async getActivityFeedRows(userId, limit, cursor) {
      calls += 1
      assert.equal(userId, 'user')
      assert.equal(limit, 51)
      assert.equal(cursor, null)
      return [
        {
          id: 'community:created',
          type: 'community_created',
          updated_at_ms: 300,
          profile: profile('owned-a'),
          friend: null,
          community,
          content: null,
          role: null
        },
        {
          id: 'friend:connected',
          type: 'friend_connected',
          updated_at_ms: 200,
          profile: profile('owned-b'),
          friend: profile('friend-a'),
          community: null,
          content: null,
          role: null
        },
        {
          id: 'post:friend',
          type: 'profile_post',
          updated_at_ms: 100,
          profile: profile('friend-a'),
          friend: null,
          community: null,
          content: '<p>Friend post</p><script>unsafe()</script>',
          role: null
        }
      ]
    },
    async transaction() {
      throw new Error('DomainService activity must not load collection snapshots.')
    }
  }
  const service = new DomainService(repository, {})

  const activity = await service.getRecentActivity('user')

  assert.equal(calls, 1)
  assert.deepEqual(activity.map(item => item.id), [
    'community:created',
    'friend:connected',
    'post:friend'
  ])
  assert.deepEqual(activity.map(item => item.updatedAt), [300, 200, 100])
  assert.equal(activity[0].community.id, 'community-1')
  assert.equal(activity[1].friend.id, 'friend-a')
  assert.equal(activity[2].content, '<p>Friend post</p>')
})

test('DomainService preserves an empty result from the relational feed query', async () => {
  const repository = {
    async getActivityFeedRows(userId, limit, cursor) {
      assert.equal(userId, 'user-without-profiles')
      assert.equal(limit, 51)
      assert.equal(cursor, null)
      return []
    },
    async transaction() {
      throw new Error('Empty activity must not load collection snapshots.')
    }
  }
  const service = new DomainService(repository, {})
  assert.deepEqual(await service.getRecentActivity('user-without-profiles'), [])
})
