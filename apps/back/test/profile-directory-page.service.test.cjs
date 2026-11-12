const test = require('node:test')
const assert = require('node:assert/strict')
const { BadRequestException, UnauthorizedException } = require('@nestjs/common')
const { ProfileDirectoryPageService } = require('../dist/api/domain/profile-directory-page.service.js')

test('friends directory uses the targeted relational query and sanitizes the page', async () => {
  const calls = []
  const result = {
    kind: 'friends',
    profile: { id: 'profile-1', about: '<p>Profile</p><script>unsafe()</script>' },
    viewerRelationship: null,
    currentProfileType: 'social',
    friendRelationships: [],
    friends: {
      items: [{ id: 'friend-1', about: '<p>Friend</p><script>unsafe()</script>' }],
      page: 2, pageSize: 20, totalItems: 1, totalPages: 1
    }
  }
  const service = new ProfileDirectoryPageService({
    async getProfileDirectoryPage(...args) { calls.push(args); return result }
  })
  const page = await service.getProfileDirectoryPage(
    '@PROFILE', 'friends', { page: 2, query: 'term', sort: 'name-asc' }, 'user-1'
  )
  assert.deepEqual(calls, [['profile', 'friends', 'user-1', 2, 'term', 'name-asc']])
  assert.equal(page.profile.about.includes('<script>'), false)
  assert.equal(page.friends.items[0].about.includes('<script>'), false)
})

test('community directory sanitizes community results and validates directory kind before querying', async () => {
  let called = false
  const service = new ProfileDirectoryPageService({
    async getProfileDirectoryPage() {
      called = true
      return {
        kind: 'communities',
        profile: { id: 'profile-1', about: '<p>Profile</p>' },
        viewerRelationship: null,
        currentProfileType: 'social',
        communities: {
          items: [{ id: 'community-1', about: '<p>Community</p><script>unsafe()</script>' }],
          page: 1, pageSize: 20, totalItems: 1, totalPages: 1
        }
      }
    }
  })
  const page = await service.getProfileDirectoryPage('profile', 'communities', { page: 1 }, null)
  assert.equal(called, true)
  assert.equal(page.communities.items[0].about.includes('<script>'), false)
  await assert.rejects(
    service.getProfileDirectoryPage('profile', 'invalid', { page: 1 }, null),
    error => error instanceof BadRequestException && error.message === 'INVALID_PROFILE_DIRECTORY'
  )
})

test('profile directory maps a missing account from the relational query', async () => {
  const service = new ProfileDirectoryPageService({
    async getProfileDirectoryPage() { throw new Error('ACCOUNT_NOT_FOUND') }
  })
  await assert.rejects(
    service.getProfileDirectoryPage('profile', 'friends', { page: 1 }, 'missing-user'),
    error => error instanceof UnauthorizedException &&
      error.getStatus() === 401 && error.message === 'ACCOUNT_NOT_FOUND'
  )
})
