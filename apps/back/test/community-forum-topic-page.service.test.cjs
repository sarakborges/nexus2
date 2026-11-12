const test = require('node:test')
const assert = require('node:assert/strict')
const { NotFoundException, UnauthorizedException } = require('@nestjs/common')
const { CommunityForumTopicPageService } = require('../dist/api/domain/community-forum-topic-page.service.js')

test('forum topic page delegates pagination to the relational query and sanitizes current-page authors', async () => {
  const calls = []
  const result = {
    community: { id: 'community-1' },
    detail: {
      topic: { id: 'topic-1', replyCount: 1 },
      replies: { items: [], page: 3, pageSize: 20, totalItems: 0, totalPages: 1 }
    },
    forumProfileId: 'profile-1',
    viewerRelationship: null,
    currentProfileType: 'social',
    isMember: true,
    isStaff: false,
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
    async getCommunityForumTopicPage(...args) {
      calls.push(args)
      return result
    }
  }
  const service = new CommunityForumTopicPageService(repository)
  const page = await service.getCommunityForumTopicPage(
    '@COMMUNITY', 'topic-1', { page: 3, query: 'text', sort: 'name-desc' }, 'account-1'
  )
  assert.deepEqual(calls, [[
    'community', 'topic-1', 'account-1', 3, 'text', 'name-desc'
  ]])
  assert.equal(page.authors[0].about.includes('<script>'), false)
  assert.equal(page.detail.replies.pageSize, 20)
})

test('forum topic page defaults reply sorting and maps relational access errors', async () => {
  const calls = []
  const repository = {
    async getCommunityForumTopicPage(...args) {
      calls.push(args)
      throw new Error('COMMUNITY_NOT_FOUND')
    }
  }
  const service = new CommunityForumTopicPageService(repository)
  await assert.rejects(
    service.getCommunityForumTopicPage('community', 'topic-1', { page: 1 }, null),
    error => error instanceof NotFoundException && error.message === 'COMMUNITY_NOT_FOUND'
  )
  assert.deepEqual(calls, [['community', 'topic-1', null, 1, undefined, 'activity-asc']])
})

test('forum topic page maps missing account and topic errors', async () => {
  for (const [code, status, exception] of [
    ['ACCOUNT_NOT_FOUND', 401, UnauthorizedException],
    ['FORUM_TOPIC_NOT_FOUND', 404, NotFoundException]
  ]) {
    const service = new CommunityForumTopicPageService({
      async getCommunityForumTopicPage() { throw new Error(code) }
    })
    await assert.rejects(
      service.getCommunityForumTopicPage('community', 'topic-1', { page: 1 }, null),
      error => error instanceof exception && error.getStatus() === status && error.message === code
    )
  }
})
