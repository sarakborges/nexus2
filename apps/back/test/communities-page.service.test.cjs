const test = require('node:test')
const assert = require('node:assert/strict')
const { UnauthorizedException } = require('@nestjs/common')
const { CommunitiesPageService } = require('../dist/api/domain/communities-page.service.js')

test('communities page uses the relational directory query and sanitizes the returned page', async () => {
  const calls = []
  const result = {
    currentProfile: { id: 'profile-1', about: '<p>About</p><script>unsafe()</script>' },
    communityTab: 'managed',
    communities: {
      items: [{ id: 'community-1', about: '<p>Community</p><script>unsafe()</script>' }],
      page: 2, pageSize: 20, totalItems: 1, totalPages: 1
    }
  }
  const service = new CommunitiesPageService({
    async getCommunitiesPage(...args) { calls.push(args); return result }
  })
  const page = await service.getCommunitiesPage('user-1', {
    page: 2, query: 'abc', sort: 'name-desc', communityTab: 'managed'
  })
  assert.deepEqual(calls, [['user-1', 2, 'abc', 'name-desc', 'managed']])
  assert.equal(page.currentProfile.about.includes('<script>'), false)
  assert.equal(page.communities.items[0].about.includes('<script>'), false)
})

test('communities page maps a missing account from the relational query', async () => {
  const service = new CommunitiesPageService({
    async getCommunitiesPage() { throw new Error('ACCOUNT_NOT_FOUND') }
  })
  await assert.rejects(
    service.getCommunitiesPage('missing-user', { page: 1 }),
    error => error instanceof UnauthorizedException &&
      error.getStatus() === 401 && error.message === 'ACCOUNT_NOT_FOUND'
  )
})
