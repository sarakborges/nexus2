const test = require('node:test')
const assert = require('node:assert/strict')
const { UnauthorizedException } = require('@nestjs/common')
const { ProfileEditPageService } = require('../dist/api/domain/profile-edit-page.service.js')

test('profile edit page uses the relational page query and sanitizes the profile', async () => {
  const calls = []
  const expected = {
    profile: {
      id: 'profile-1',
      url: 'profile',
      about: '<p>About</p><script>unsafe()</script>'
    },
    currentProfileType: 'social'
  }
  const service = new ProfileEditPageService({
    async getProfileEditPage(...args) {
      calls.push(args)
      return expected
    }
  })
  const page = await service.getProfileEditPage('@PROFILE', 'user-1')
  assert.deepEqual(calls, [['profile', 'user-1']])
  assert.equal(page.profile.about.includes('<script>'), false)
  assert.equal(page.currentProfileType, 'social')
})

test('profile edit page maps a missing account from the relational query', async () => {
  const service = new ProfileEditPageService({
    async getProfileEditPage() { throw new Error('ACCOUNT_NOT_FOUND') }
  })
  await assert.rejects(
    service.getProfileEditPage('profile', 'missing-user'),
    error => error instanceof UnauthorizedException &&
      error.getStatus() === 401 && error.message === 'ACCOUNT_NOT_FOUND'
  )
})
