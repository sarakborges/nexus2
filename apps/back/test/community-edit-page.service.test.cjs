const test = require('node:test')
const assert = require('node:assert/strict')
const { UnauthorizedException } = require('@nestjs/common')
const { CommunityEditPageService } = require('../dist/api/domain/community-edit-page.service.js')

test('community edit page uses the relational page query with a normalized URL', async () => {
  const calls = []
  const expected = {
    community: { id: 'community-1', url: 'community' },
    ownerProfileId: 'profile-1',
    currentProfileType: 'social'
  }
  const service = new CommunityEditPageService({
    async getCommunityEditPage(...args) {
      calls.push(args)
      return expected
    }
  })
  assert.deepEqual(await service.getCommunityEditPage('@COMMUNITY', 'user-1'), expected)
  assert.deepEqual(calls, [['community', 'user-1']])
})

test('community edit page maps a missing account from the relational query', async () => {
  const service = new CommunityEditPageService({
    async getCommunityEditPage() { throw new Error('ACCOUNT_NOT_FOUND') }
  })
  await assert.rejects(
    service.getCommunityEditPage('community', 'missing-user'),
    error => error instanceof UnauthorizedException &&
      error.getStatus() === 401 && error.message === 'ACCOUNT_NOT_FOUND'
  )
})
