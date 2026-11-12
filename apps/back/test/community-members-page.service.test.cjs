const test = require('node:test')
const assert = require('node:assert/strict')
const { NotFoundException, UnauthorizedException } = require('@nestjs/common')
const { CommunityMembersPageService } = require('../dist/api/domain/community-members-page.service.js')

test('community members page uses the relational query for both paginated lists and sanitizes profiles', async () => {
  const calls = []
  const result = {
    community: { id: 'community-1' },
    relationships: [],
    viewerRelationship: null,
    currentProfileType: 'social',
    actorProfileId: 'profile-1',
    actorRole: 'moderator',
    isStaff: true,
    visibleTab: 'staff',
    members: {
      items: [{ id: 'member-1', about: '<p>Member</p><script>unsafe()</script>' }],
      page: 2, pageSize: 20, totalItems: 1, totalPages: 1
    },
    pending: {
      items: [{ id: 'pending-1', about: '<p>Pending</p><script>unsafe()</script>' }],
      page: 3, pageSize: 20, totalItems: 1, totalPages: 1
    }
  }
  const service = new CommunityMembersPageService({
    async getCommunityMembersPage(...args) { calls.push(args); return result }
  })
  const page = await service.getCommunityMembersPage('community', {
    page: 2, pendingPage: 3, query: 'abc', sort: 'name-desc', tab: 'staff'
  }, 'user-1')
  assert.deepEqual(calls, [[
    'community', 'user-1', 2, 3, 'abc', 'name-desc', 'staff'
  ]])
  assert.equal(page.members.items[0].about.includes('<script>'), false)
  assert.equal(page.pending.items[0].about.includes('<script>'), false)
})

test('community members page maps account and privacy errors from the relational query', async () => {
  for (const [code, exception, status] of [
    ['ACCOUNT_NOT_FOUND', UnauthorizedException, 401],
    ['COMMUNITY_NOT_FOUND', NotFoundException, 404]
  ]) {
    const service = new CommunityMembersPageService({
      async getCommunityMembersPage() { throw new Error(code) }
    })
    await assert.rejects(
      service.getCommunityMembersPage('community', { page: 1, pendingPage: 1 }, 'user-1'),
      error => error instanceof exception && error.getStatus() === status && error.message === code
    )
  }
})
