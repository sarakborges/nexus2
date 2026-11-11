const test = require('node:test')
const assert = require('node:assert/strict')
const { ForbiddenException, ConflictException, NotFoundException } = require('@nestjs/common')
const { ProfileRelationshipService } = require('../dist/api/domain/profile-relationship.service.js')

test('profile relationship writes use targeted relational operations and return the canonical pair', async () => {
  const calls = []
  const repository = {
    async upsertProfileRelationship(change) { calls.push(['upsert', change]) },
    async removeProfileRelationship(change) { calls.push(['remove', change]) },
    async transaction() {
      throw new Error('Profile relationship writes must not use collection snapshots.')
    }
  }
  const service = new ProfileRelationshipService(repository, {})

  const result = await service.updateProfileRelationship(
    'account-1',
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    '00000000-0000-4000-8000-000000000001',
    'requested'
  )
  await service.removeProfileRelationship(
    'account-1',
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    '00000000-0000-4000-8000-000000000001'
  )

  assert.deepEqual(result.profiles, [
    '00000000-0000-4000-8000-000000000001',
    'ffffffff-ffff-4fff-8fff-ffffffffffff'
  ])
  assert.equal(result.type, 'requested')
  assert.equal(result.requestedBy, 'ffffffff-ffff-4fff-8fff-ffffffffffff')
  assert.equal(result.blockedBy, null)
  assert.equal(calls[0][0], 'upsert')
  assert.equal(calls[0][1].userId, 'account-1')
  assert.equal(calls[0][1].type, 'requested')
  assert.equal(calls[1][0], 'remove')
  assert.equal(calls[1][1].sourceProfileId, 'ffffffff-ffff-4fff-8fff-ffffffffffff')
})

test('profile relationship RPC errors preserve domain error codes', async () => {
  const cases = [
    ['PROFILE_NOT_OWNED', ForbiddenException],
    ['PROFILE_TYPE_MISMATCH', ForbiddenException],
    ['INVALID_RELATIONSHIP_PARTICIPANTS', ForbiddenException],
    ['ONLY_RECIPIENT_CAN_ACCEPT_REQUEST', ForbiddenException],
    ['ONLY_BLOCKER_CAN_UNBLOCK', ForbiddenException],
    ['RELATIONSHIP_ALREADY_EXISTS', ConflictException],
    ['PROFILE_NOT_FOUND', NotFoundException]
  ]

  for (const [message, ErrorType] of cases) {
    const repository = {
      async upsertProfileRelationship() {
        throw new Error('Supabase relational request failed (403): {"message":"' + message + '"}')
      },
      async removeProfileRelationship() {
        throw new Error('Supabase relational request failed (403): {"message":"' + message + '"}')
      }
    }
    const service = new ProfileRelationshipService(repository, {})
    await assert.rejects(
      service.updateProfileRelationship('account-1', 'profile-1', 'profile-2', 'requested'),
      error => error instanceof ErrorType && error.message === message
    )
    await assert.rejects(
      service.removeProfileRelationship('account-1', 'profile-1', 'profile-2'),
      error => error instanceof ErrorType && error.message === message
    )
  }
})


test('profile relationship reads use targeted repository queries without snapshots', async () => {
  const repository = {
    async getProfileRelationships(userId, profileId) {
      assert.equal(userId, 'account-1')
      assert.equal(profileId, 'profile-1')
      return [{ profiles: ['profile-1','profile-2'], type: 'connection', updatedAt: 1 }]
    },
    async getProfileFriends(profileId, page) {
      assert.equal(profileId, 'profile-1')
      assert.equal(page, 2)
      return {
        items: [{ id: 'profile-2', about: '<p>Friend</p><script>unsafe()</script>' }],
        page: 2, pageSize: 20, totalItems: 21, totalPages: 2
      }
    },
    async transaction() { throw new Error('Relationship reads must not load collection snapshots.') }
  }
  const service = new ProfileRelationshipService(repository, {})
  const relationships = await service.getProfileRelationships('account-1','profile-1')
  const friends = await service.getProfileFriends('profile-1',{ page: 2 })
  assert.equal(relationships.length, 1)
  assert.equal(friends.items[0].about.includes('<script>'), false)
})
