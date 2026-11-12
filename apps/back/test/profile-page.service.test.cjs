const test = require('node:test')
const assert = require('node:assert/strict')
const { UnauthorizedException } = require('@nestjs/common')
const { ProfilePageService } = require('../dist/api/domain/profile-page.service.js')

test('profile page delegates to the relational page query and sanitizes profile previews', async () => {
  const calls = []
  const result = {
    profile: { id: 'profile-1', about: '<p>Profile</p><script>unsafe()</script>' },
    viewerRelationship: null,
    currentProfileType: 'social',
    friends: {
      items: [{ id: 'friend-1', about: '<p>Friend</p><script>unsafe()</script>' }],
      page: 1, pageSize: 20, totalItems: 1, totalPages: 1
    },
    communities: { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 1 }
  }
  const service = new ProfilePageService({
    async getProfilePage(...args) { calls.push(args); return result }
  })
  const page = await service.getProfilePage('@PROFILE', 'user-1')
  assert.deepEqual(calls, [['profile', 'user-1']])
  assert.equal(page.profile.about.includes('<script>'), false)
  assert.equal(page.friends.items[0].about.includes('<script>'), false)
})

test('profile page maps a missing account from the relational query', async () => {
  const service = new ProfilePageService({
    async getProfilePage() { throw new Error('ACCOUNT_NOT_FOUND') }
  })
  await assert.rejects(
    service.getProfilePage('profile', 'missing-user'),
    error => error instanceof UnauthorizedException &&
      error.getStatus() === 401 && error.message === 'ACCOUNT_NOT_FOUND'
  )
})
