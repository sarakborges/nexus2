const assert = require('node:assert/strict')
const { test } = require('node:test')
const { DomainAccessService } = require('../dist/api/domain/domain-access.service.js')

test('readSuggestedCommunities requests sixteen entries for the home 4x4 preview', async () => {
  let request
  const suggestions = Array.from({ length: 16 }, (_, index) => ({
    id: 'community-' + index,
    name: 'Community ' + index,
    url: 'community-' + index,
    picture: '',
    about: '',
    type: 'social',
    privacy: 'public',
    createdAt: index + 1,
    lastActivity: index + 1
  }))
  const service = new DomainAccessService({
    async getSuggestedCommunities(profileId, limit) {
      request = { profileId, limit }
      return suggestions
    }
  })

  const result = await service.readSuggestedCommunities('active-profile')

  assert.deepEqual(request, { profileId: 'active-profile', limit: 16 })
  assert.equal(result.length, 16)
  assert.equal(result[0].id, 'community-0')
  assert.equal(result[15].id, 'community-15')
})


test('unknown community privacy fails closed instead of becoming public', async () => {
  const community = {
    id: 'community-unknown-privacy',
    name: 'Unknown privacy',
    url: 'unknown-privacy',
    picture: '',
    about: '',
    type: 'social',
    privacy: 'unrecognized',
    createdAt: 1,
    lastActivity: 1
  }
  const service = new DomainAccessService({
    async getCommunitiesByIds() { return [community] }
  })

  await assert.rejects(
    service.readCommunitiesByIds([community.id]),
    error => error instanceof Error && error.message === 'INVALID_COMMUNITY_PRIVACY'
  )
})

test('unknown community privacy is not readable through access checks', () => {
  const service = new DomainAccessService({})
  const community = {
    id: 'community-unknown-privacy',
    privacy: 'unrecognized'
  }

  assert.throws(
    () => service.assertCommunityReadableInRecords(
      community.id,
      null,
      [],
      [community],
      []
    ),
    error => typeof error.getStatus === 'function' && error.getStatus() === 404
  )
})
