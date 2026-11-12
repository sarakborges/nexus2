const test = require('node:test')
const assert = require('node:assert/strict')
const { UnauthorizedException } = require('@nestjs/common')
const { ProfileMessagesPageService } = require('../dist/api/domain/profile-messages-page.service.js')

test('profile messages page delegates filtering and pagination to the relational query', async () => {
  const calls = []
  const result = {
    profile: { id: 'profile-1', about: '<p>Profile</p><script>unsafe()</script>' },
    viewerRelationship: null,
    currentProfileType: 'social',
    isProfileOwner: true,
    messageTab: 'favorites',
    messages: {
      items: [{
        id: 'message-1',
        content: '<p>Message</p><script>unsafe()</script>',
        isFavorite: 1
      }],
      page: 2, pageSize: 20, totalItems: 1, totalPages: 1
    },
    senders: [{
      id: 'sender-1',
      about: '<p>Sender</p><script>unsafe()</script>'
    }],
    messagePermissions: {}
  }
  const service = new ProfileMessagesPageService({
    async getProfileMessagesPage(...args) { calls.push(args); return result }
  })
  const page = await service.getProfileMessagesPage(
    '@PROFILE',
    { page: 2, query: 'hello', sort: 'activity-desc', messageTab: 'favorites' },
    'user-1'
  )
  assert.deepEqual(calls, [['profile', 'user-1', 2, 'hello', 'activity-desc', 'favorites']])
  assert.equal(page.profile.about.includes('<script>'), false)
  assert.equal(page.messages.items[0].content.includes('<script>'), false)
  assert.equal(page.messages.items[0].isFavorite, true)
  assert.equal(page.senders[0].about.includes('<script>'), false)
})

test('profile messages page maps a missing account from the relational query', async () => {
  const service = new ProfileMessagesPageService({
    async getProfileMessagesPage() { throw new Error('ACCOUNT_NOT_FOUND') }
  })
  await assert.rejects(
    service.getProfileMessagesPage('profile', { page: 1 }, 'missing-user'),
    error => error instanceof UnauthorizedException &&
      error.getStatus() === 401 && error.message === 'ACCOUNT_NOT_FOUND'
  )
})
