const test = require('node:test')
const assert = require('node:assert/strict')
const { UnauthorizedException } = require('@nestjs/common')
const { CommunityForumComposerPageService } = require('../dist/api/domain/community-forum-composer-page.service.js')

test('forum composer delegates to the relational query and sanitizes the selected profile', async () => {
  const calls = []
  const repository = {
    async getCommunityForumComposerPage(...args) {
      calls.push(args)
      return {
        community: { id: 'community-1' },
        forumProfile: {
          id: 'profile-member',
          about: '<p>Member</p><script>unsafe()</script>'
        },
        viewerRelationship: null,
        currentProfileType: 'social'
      }
    }
  }
  const service = new CommunityForumComposerPageService(repository)
  const result = await service.getCommunityForumComposerPage('PUBLIC', 'user-1')
  assert.deepEqual(calls, [['public', 'user-1']])
  assert.equal(result.forumProfile.about.includes('<script>'), false)
})

test('forum composer maps a missing account from the relational query', async () => {
  const service = new CommunityForumComposerPageService({
    async getCommunityForumComposerPage() { throw new Error('ACCOUNT_NOT_FOUND') }
  })
  await assert.rejects(
    service.getCommunityForumComposerPage('public', 'missing-user'),
    error => error instanceof UnauthorizedException &&
      error.getStatus() === 401 && error.message === 'ACCOUNT_NOT_FOUND'
  )
})
