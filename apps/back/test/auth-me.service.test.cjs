const assert = require('node:assert/strict')
const { test } = require('node:test')
const { AuthMeService } = require('../dist/api/auth/auth-me.service.js')

test('me response includes the active owned profile and the first relational feed page', async () => {
  const user = {
    id: 'account-1',
    email: 'person@example.com',
    profiles: ['profile-1', 'profile-2'],
    currentProfile: 'profile-2'
  }
  const profile = {
    id: 'profile-2',
    name: 'Active profile',
    url: 'active-profile',
    picture: '',
    about: '',
    type: 'social',
    createdAt: 100,
    lastActivity: 200
  }
  const feedPage = {
    items: [{ id: 'post-1', type: 'profile_post', updatedAt: 300 }],
    nextCursor: { updatedAt: 300, id: 'post-1' },
    hasMore: true
  }
  const calls = []
  const service = new AuthMeService(
    { async getUser(userId) { calls.push(['user', userId]); return user } },
    { async getRecentActivityPage(userId, limit) {
      calls.push(['feed', userId, limit])
      return feedPage
    } },
    { async readProfilesByIds(ids) {
      calls.push(['profiles', ids])
      return [profile]
    } }
  )

  const result = await service.getMe('account-1')

  assert.deepEqual(result, {
    user,
    currentProfile: profile,
    activities: feedPage.items,
    activityCursor: feedPage.nextCursor,
    hasMoreActivities: true
  })
  assert.deepEqual(calls, [
    ['user', 'account-1'],
    ['profiles', ['profile-2']],
    ['feed', 'account-1', 10]
  ])
})

test('me response falls back to the first owned profile when no current profile is selected', async () => {
  const profile = { id: 'profile-first', name: 'First' }
  const service = new AuthMeService(
    { async getUser() {
      return {
        id: 'account-2',
        email: 'another@example.com',
        profiles: ['profile-first', 'profile-second'],
        currentProfile: null
      }
    } },
    { async getRecentActivityPage() {
      return { items: [], nextCursor: null, hasMore: false }
    } },
    { async readProfilesByIds(ids) {
      assert.deepEqual(ids, ['profile-first'])
      return [profile]
    } }
  )

  const result = await service.getMe('account-2')
  assert.deepEqual(result.currentProfile, profile)
})
