const test = require('node:test')
const assert = require('node:assert/strict')
const {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException
} = require('@nestjs/common')
const { CommunityMembershipService } = require('../dist/api/domain/community-membership.service.js')

test('community membership and role mutations use one targeted relational write', async () => {
  const calls = []
  const repository = {
    async changeCommunityRelationship(change) { calls.push(change) },
    async transaction() {
      throw new Error('Community membership writes must not load collection snapshots.')
    }
  }
  const service = new CommunityMembershipService(repository, {})

  const membership = await service.updateCommunityRelationship(
    'account-1',
    'community-1',
    'profile-2',
    'profile-1',
    'connection'
  )
  await service.removeCommunityRelationship('account-1', 'community-1', 'profile-2', 'profile-1')
  await service.demoteModerator('account-1', 'community-1', 'profile-2', 'profile-1')
  await service.transferOwnership('account-1', 'community-1', 'profile-2', 'profile-1')

  assert.deepEqual(membership, {
    profiles: ['profile-2', 'community-1'],
    type: 'connection',
    requestedBy: null,
    blockedBy: null,
    updatedAt: membership.updatedAt
  })
  assert.equal(calls.length, 4)
  assert.deepEqual(calls.map(call => call.action), ['connection', 'remove', 'demote', 'transfer'])
  assert.ok(calls.every(call =>
    call.userId === 'account-1' &&
    call.communityId === 'community-1' &&
    call.actorProfileId === 'profile-1'
  ))
})

test('community relationship RPC errors preserve the existing authorization messages', async () => {
  const cases = [
    ['PROFILE_NOT_OWNED', ForbiddenException],
    ['PROFILE_TYPE_MISMATCH', ForbiddenException],
    ['PROFILE_NOT_FOUND', NotFoundException],
    ['COMMUNITY_NOT_FOUND', NotFoundException],
    ['COMMUNITY_ACTION_NOT_ALLOWED', ForbiddenException],
    ['ONLY_OWNER_CAN_DEMOTE_MODERATOR', ForbiddenException],
    ['OWNERSHIP_TRANSFER_NOT_ALLOWED', ForbiddenException],
    ['ACCOUNT_NOT_FOUND', UnauthorizedException]
  ]

  for (const [message, ErrorType] of cases) {
    const repository = {
      async changeCommunityRelationship() {
        throw new Error('Supabase relational request failed (403): {"message":"' + message + '"}')
      }
    }
    const service = new CommunityMembershipService(repository, {})
    await assert.rejects(
      service.updateCommunityRelationship(
        'account-1', 'community-1', 'profile-2', 'profile-1', 'connection'
      ),
      error => error instanceof ErrorType && error.message === message
    )
  }
})
