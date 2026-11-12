const test = require('node:test')
const assert = require('node:assert/strict')
const { UnauthorizedException } = require('@nestjs/common')
const { CommunityForumPageService } = require('../dist/api/domain/community-forum-page.service.js')

test('forum page delegates to the relational page query and sanitizes current-page authors', async () => {
  const calls = []
  const result = {
    community: { id: 'community-1' },
    viewerRelationship: null,
    currentProfileType: 'social',
    canReadForum: true,
    canPublish: false,
    topics: { items: [], page: 2, pageSize: 20, totalItems: 0, totalPages: 1 },
    authors: [{
      id: 'profile-1',
      name: 'Author',
      url: 'author',
      picture: '',
      about: '<p>About</p><script>unsafe()</script>',
      type: 'social',
      createdAt: 1,
      lastActivity: 2
    }]
  }
  const repository = {
    async getCommunityForumPage(...args) {
      calls.push(args)
      return result
    }
  }
  const service = new CommunityForumPageService(repository)
  const page = await service.getCommunityForumPage(
    '@COMMUNITY', { page: 2, query: 'term', sort: 'name-asc' }, 'account-1'
  )
  assert.deepEqual(calls, [['community', 'account-1', 2, 'term', 'name-asc']])
  assert.equal(page.authors[0].about.includes('<script>'), false)
  assert.equal(page.topics.pageSize, 20)
})

test('forum page maps a missing account from the relational query', async () => {
  const service = new CommunityForumPageService({
    async getCommunityForumPage() { throw new Error('ACCOUNT_NOT_FOUND') }
  })
  await assert.rejects(
    service.getCommunityForumPage('community', { page: 1 }, 'missing-user'),
    error => error instanceof UnauthorizedException &&
      error.getStatus() === 401 && error.message === 'ACCOUNT_NOT_FOUND'
  )
})
