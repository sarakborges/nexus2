const test = require('node:test')
const assert = require('node:assert/strict')
const { UnauthorizedException } = require('@nestjs/common')
const { CommunityPageService } = require('../dist/api/domain/community-page.service.js')

test('community page uses the relational page query and sanitizes member and forum authors', async () => {
  const calls = []
  const result = {
    community: { id: 'community-1' },
    relationships: [],
    viewerRelationship: null,
    currentProfileType: 'social',
    canViewMembers: true,
    canEditCommunity: false,
    pendingRequestCount: 0,
    members: {
      items: [{ id: 'member-1', about: '<p>Member</p><script>unsafe()</script>' }],
      page: 1, pageSize: 20, totalItems: 1, totalPages: 1
    },
    forumTopics: { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 1 },
    forumAuthors: [{ id: 'author-1', about: '<p>Author</p><script>unsafe()</script>' }]
  }
  const service = new CommunityPageService({
    async getCommunityPage(...args) {
      calls.push(args)
      return result
    }
  })
  const page = await service.getCommunityPage('@COMMUNITY', 'user-1')
  assert.deepEqual(calls, [['community', 'user-1']])
  assert.equal(page.members.items[0].about.includes('<script>'), false)
  assert.equal(page.forumAuthors[0].about.includes('<script>'), false)
})

test('community page maps a missing account from the relational query', async () => {
  const service = new CommunityPageService({
    async getCommunityPage() { throw new Error('ACCOUNT_NOT_FOUND') }
  })
  await assert.rejects(
    service.getCommunityPage('community', 'missing-user'),
    error => error instanceof UnauthorizedException &&
      error.getStatus() === 401 && error.message === 'ACCOUNT_NOT_FOUND'
  )
})
