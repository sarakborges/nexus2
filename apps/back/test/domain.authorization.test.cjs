const test = require('node:test')
const assert = require('node:assert/strict')
const { DomainService } = require('../dist/api/domain/domain.service.js')

const communityId = 'community-1'
const community = {
  id: communityId,
  name: 'Test community',
  url: 'test-community',
  picture: '',
  about: 'Community details',
  type: 'social'
}
const page = { page: 1, pageSize: 20 }

function relationship(profileId, type) {
  return {
    profiles: [profileId, communityId],
    type,
    requestedBy: type === 'requested' ? profileId : null,
    blockedBy: type === 'blocked' ? profileId : null,
    updatedAt: 1
  }
}

function createDomainHarness({ userProfiles = {}, relationships = [], privacy = 'public' } = {}) {
  const collections = new Map([
    ['communities', [{ ...community, privacy }]],
    ['community_relationships', relationships],
    ['profiles', [
      { id: 'owner-1', name: 'Owner', url: 'owner', picture: '', about: '', type: 'social' },
      { id: 'moderator-1', name: 'Moderator', url: 'moderator', picture: '', about: '', type: 'social' },
      { id: 'member-1', name: 'Member', url: 'member', picture: '', about: '', type: 'social' },
      { id: 'banned-1', name: 'Banned', url: 'banned', picture: '', about: '', type: 'social' },
      { id: 'pending-1', name: 'Pending', url: 'pending', picture: '', about: '', type: 'social' },
      { id: 'target-1', name: 'Target', url: 'target', picture: '', about: '', type: 'social' }
    ]]
  ])
  const data = {
    async read(name) { return structuredClone(collections.get(name) ?? []) },
    async update(name, updater) {
      const next = updater(structuredClone(collections.get(name) ?? []))
      collections.set(name, structuredClone(next))
      return structuredClone(next)
    }
  }
  const auth = {
    async getUser(userId) {
      const profiles = userProfiles[userId] ?? []
      return { id: userId, email: `${userId}@example.com`, profiles, currentProfile: profiles[0] ?? null }
    },
    async ownsProfile(userId, profileId) {
      return (userProfiles[userId] ?? []).includes(profileId)
    }
  }
  return { service: new DomainService(data, auth), collections }
}


test('unlisted communities stay out of directories but remain accessible by direct URL', async () => {
  const { service } = createDomainHarness({ privacy: 'unlisted' })

  const directory = await service.listCommunities(page)
  const direct = await service.getCommunity('test-community')

  assert.equal(directory.totalItems, 0)
  assert.equal(direct.privacy, 'unlisted')
  assert.equal(direct.about, 'Community details')
})

test('private communities expose only a preview and restrict member and forum reads', async () => {
  const { service } = createDomainHarness({
    privacy: 'private',
    relationships: [relationship('owner-1', 'owner')]
  })

  const preview = await service.getCommunity('test-community')

  assert.equal(preview.name, 'Test community')
  assert.equal(preview.picture, '')
  assert.equal(preview.about, '')
  await assert.rejects(
    service.listCommunityMembers(communityId, 'all', page, null),
    error => error.getStatus() === 404
  )
  await assert.rejects(
    service.listCommunityForumTopics(communityId, page),
    error => error.getStatus() === 404
  )
})

test('private community members can access the full community and member list', async () => {
  const { service } = createDomainHarness({
    privacy: 'private',
    userProfiles: { memberUser: ['member-1'] },
    relationships: [
      relationship('owner-1', 'owner'),
      relationship('member-1', 'connection')
    ]
  })

  const visible = await service.getCommunity('test-community', 'memberUser')
  const members = await service.listCommunityMembers(communityId, 'all', page, 'memberUser', 'member-1')

  assert.equal(visible.about, 'Community details')
  assert.deepEqual(members.items.map(item => item.id).sort(), ['member-1', 'owner-1'])
})

test('anonymous callers never receive private community relationship records', async () => {
  const { service } = createDomainHarness({
    relationships: [relationship('owner-1', 'owner'), relationship('banned-1', 'blocked')]
  })

  assert.deepEqual(await service.getCommunityRelationships(null, communityId), [])
})

test('authenticated callers only receive relationships for profiles they own', async () => {
  const { service } = createDomainHarness({
    userProfiles: { user: ['owner-1'] },
    relationships: [
      relationship('owner-1', 'owner'),
      relationship('moderator-1', 'moderator'),
      relationship('banned-1', 'blocked')
    ]
  })

  const visible = await service.getCommunityRelationships('user', communityId)
  assert.deepEqual(visible.map(item => item.profiles[0]), ['owner-1'])
  assert.deepEqual(visible.map(item => item.type), ['owner'])
})

test('anonymous callers cannot read staff or banned member tabs', async () => {
  const { service } = createDomainHarness({
    relationships: [relationship('owner-1', 'owner')]
  })

  await assert.rejects(
    service.listCommunityMembers(communityId, 'staff', page, null, 'owner-1'),
    error => error.getStatus() === 403
  )
  await assert.rejects(
    service.listCommunityMembers(communityId, 'banned', page, null, 'owner-1'),
    error => error.getStatus() === 403
  )
})

test('an ordinary member cannot read staff or banned member tabs', async () => {
  const { service } = createDomainHarness({
    userProfiles: { memberUser: ['member-1'] },
    relationships: [
      relationship('owner-1', 'owner'),
      relationship('member-1', 'connection'),
      relationship('banned-1', 'blocked')
    ]
  })

  await assert.rejects(
    service.listCommunityMembers(communityId, 'staff', page, 'memberUser', 'member-1'),
    error => error.getStatus() === 403
  )
  await assert.rejects(
    service.listCommunityMembers(communityId, 'banned', page, 'memberUser', 'member-1'),
    error => error.getStatus() === 403
  )
})

test('community staff can read only the matching staff and banned tabs', async () => {
  const { service } = createDomainHarness({
    userProfiles: { ownerUser: ['owner-1'] },
    relationships: [
      relationship('owner-1', 'owner'),
      relationship('moderator-1', 'moderator'),
      relationship('member-1', 'connection'),
      relationship('banned-1', 'blocked'),
      relationship('pending-1', 'requested')
    ]
  })

  const staff = await service.listCommunityMembers(communityId, 'staff', page, 'ownerUser', 'owner-1')
  const banned = await service.listCommunityMembers(communityId, 'banned', page, 'ownerUser', 'owner-1')

  assert.deepEqual(staff.items.map(item => item.id).sort(), ['moderator-1', 'owner-1'])
  assert.deepEqual(banned.items.map(item => item.id), ['banned-1'])
})

test('a caller cannot impersonate a community owner by supplying their profile id', async () => {
  const { service } = createDomainHarness({
    userProfiles: { memberUser: ['member-1'] },
    relationships: [
      relationship('owner-1', 'owner'),
      relationship('member-1', 'connection'),
      relationship('target-1', 'connection')
    ]
  })

  await assert.rejects(
    service.updateCommunityRelationship('memberUser', communityId, 'target-1', 'owner-1', 'moderator'),
    error => error.getStatus() === 403 && error.message === 'PROFILE_NOT_OWNED'
  )
})

test('a non-staff member cannot access pending join requests', async () => {
  const { service } = createDomainHarness({
    userProfiles: { memberUser: ['member-1'] },
    relationships: [
      relationship('owner-1', 'owner'),
      relationship('member-1', 'connection'),
      relationship('pending-1', 'requested')
    ]
  })

  await assert.rejects(
    service.listPendingMembers('memberUser', communityId, 'member-1', page),
    error => error.getStatus() === 403
  )
})
