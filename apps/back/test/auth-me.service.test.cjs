const assert = require('node:assert/strict')
const { test } = require('node:test')
const { AuthMeService } = require('../dist/api/auth/auth-me.service.js')

const defaultProfileSettings = {
  messageAudience: 'everyone',
  publishActivityTypes: [
    'friend_connected',
    'profile_post',
    'community_created',
    'community_membership'
  ],
  showFriendActivityTypes: [
    'friend_connected',
    'profile_post',
    'community_created',
    'community_membership'
  ]
}

test('me response includes the active owned profile, settings and first relational feed page', async () => {
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
    }, async readSuggestedCommunities(profileId) {
      calls.push(['suggestions', profileId])
      return [{ id: 'community-1', name: 'Suggested' }]
    } },
    { async getSettings(accountId, profileId) {
      calls.push(['settings', accountId, profileId])
      return defaultProfileSettings
    } }
  )

  const result = await service.getMe('account-1')

  assert.deepEqual(result, {
    user,
    currentProfile: profile,
    currentProfileSettings: defaultProfileSettings,
    suggestedCommunities: [{ id: 'community-1', name: 'Suggested' }],
    activities: feedPage.items,
    activityCursor: feedPage.nextCursor,
    hasMoreActivities: true
  })
  assert.deepEqual(calls, [
    ['user', 'account-1'],
    ['profiles', ['profile-2']],
    ['feed', 'account-1', 10],
    ['settings', 'account-1', 'profile-2'],
    ['suggestions', 'profile-2']
  ])
})

test('me does not silently select a profile when the account has no active selection', async () => {
  const user = {
    id: 'account-2',
    email: 'another@example.com',
    profiles: ['profile-first', 'profile-second'],
    currentProfile: null
  }
  const feedPage = { items: [], nextCursor: null, hasMore: false }
  const calls = []
  const service = new AuthMeService(
    { async getUser() { calls.push(['user']); return user }, async updateCurrentProfile() {
      assert.fail('The session must not choose a profile automatically')
    } },
    { async getRecentActivityPage() {
      assert.fail('The profile-scoped feed must not be fetched without an active profile')
    } },
    { async readProfilesByIds() {
      assert.fail('No profile should be resolved without an explicit selection')
    }, async readSuggestedCommunities() {
      assert.fail('Suggestions should not be fetched without an active profile')
    } },
    { async getSettings() {
      assert.fail('Settings should not be fetched without an active profile')
    } }
  )

  const result = await service.getMe('account-2')

  assert.deepEqual(result, {
    user,
    currentProfile: null,
    currentProfileSettings: null,
    suggestedCommunities: [],
    activities: [],
    activityCursor: null,
    hasMoreActivities: false
  })
  assert.deepEqual(calls, [['user']])
})

test('me also refuses a stale current-profile id that is not owned by the account', async () => {
  const user = {
    id: 'account-3',
    email: 'stale@example.com',
    profiles: ['profile-owned'],
    currentProfile: 'profile-not-owned'
  }
  const service = new AuthMeService(
    { async getUser() { return user }, async updateCurrentProfile() {
      assert.fail('A stale selection must not be replaced automatically')
    } },
    { async getRecentActivityPage() {
      return { items: [], nextCursor: null, hasMore: false }
    } },
    { async readProfilesByIds() {
      assert.fail('A stale profile must not be loaded')
    }, async readSuggestedCommunities() {
      assert.fail('Suggestions require a selected owned profile')
    } },
    { async getSettings() {
      assert.fail('Settings require a selected owned profile')
    } }
  )

  const result = await service.getMe('account-3')
  assert.equal(result.user.currentProfile, 'profile-not-owned')
  assert.equal(result.currentProfile, null)
  assert.equal(result.currentProfileSettings, null)
  assert.deepEqual(result.suggestedCommunities, [])
})
