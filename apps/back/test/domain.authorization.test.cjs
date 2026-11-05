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

function createDomainHarness({ userProfiles = {}, relationships = [], privacy = 'public', beforeTransaction } = {}) {
  const collections = new Map([
    ['accounts', Object.entries(userProfiles).map(([id, profiles]) => ({
      id, email: `${id}@example.com`, profiles: [...profiles], currentProfile: profiles[0] ?? null
    }))],
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
    },
    async transaction(names, updater) {
      beforeTransaction?.(names, collections)
      const snapshot = Object.fromEntries(names.map(name => [
        name, structuredClone(collections.get(name) ?? [])
      ]))
      const outcome = updater(snapshot)
      for (const name of names) {
        if (!Array.isArray(outcome.records[name])) throw new Error('INVALID_TRANSACTION_RECORDS')
      }
      for (const name of names) collections.set(name, structuredClone(outcome.records[name]))
      return structuredClone(outcome.result)
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

test('community type inherits the owner profile type and persists the normalized value', async () => {
  const { service, collections } = createDomainHarness({
    relationships: [relationship('owner-1', 'owner')]
  })
  collections.set('profiles', collections.get('profiles').map(profile =>
    profile.id === 'owner-1' ? { ...profile, type: 'business' } : profile
  ))

  const visible = await service.getCommunity('test-community')

  assert.equal(visible.type, 'business')
  assert.equal(collections.get('communities')[0].type, 'business')
})

test('community normalization reads owner type and privacy from one transaction snapshot', async () => {
  const { service, collections } = createDomainHarness({
    relationships: [relationship('owner-1', 'owner')],
    beforeTransaction(names, current) {
      assert.deepEqual([...names].sort(), [
        'communities', 'community_relationships', 'profiles'
      ])
      current.set('profiles', current.get('profiles').map(profile =>
        profile.id === 'owner-1' ? { ...profile, type: 'business' } : profile
      ))
    }
  })
  collections.set('communities', [{ ...community, type: 'social', privacy: 'invalid' }])

  const visible = await service.listCommunities(page)

  assert.equal(visible.items[0].type, 'business')
  assert.equal(visible.items[0].privacy, 'public')
  assert.equal(collections.get('communities')[0].type, 'business')
  assert.equal(collections.get('communities')[0].privacy, 'public')
})



test('community relationship mutations recheck profile ownership in the transaction', async () => {
  const original = [
    relationship('owner-1', 'owner'),
    relationship('target-1', 'connection')
  ]
  const { service, collections } = createDomainHarness({
    userProfiles: { ownerUser: ['owner-1'] },
    relationships: original,
    beforeTransaction(_names, current) {
      current.set('accounts', [])
    }
  })

  await assert.rejects(
    service.updateCommunityRelationship('ownerUser', communityId, 'target-1', 'owner-1', 'moderator'),
    error => error.getStatus() === 403 && error.message === 'PROFILE_NOT_OWNED'
  )
  assert.deepEqual(collections.get('community_relationships'), original)
})

test('removing a community member rechecks actor ownership in the same transaction', async () => {
  const original = [
    relationship('owner-1', 'owner'),
    relationship('member-1', 'connection')
  ]
  const { service, collections } = createDomainHarness({
    userProfiles: { ownerUser: ['owner-1'] },
    relationships: original,
    beforeTransaction(_names, current) {
      current.set('accounts', [])
    }
  })

  await assert.rejects(
    service.removeCommunityRelationship('ownerUser', communityId, 'member-1', 'owner-1'),
    error => error.getStatus() === 403 && error.message === 'PROFILE_NOT_OWNED'
  )
  assert.deepEqual(collections.get('community_relationships'), original)
})

test('demoting a moderator rechecks the owner role inside the relationship transaction', async () => {
  const original = [
    relationship('owner-1', 'owner'),
    relationship('moderator-1', 'moderator')
  ]
  const afterTransfer = original.map(record =>
    record.profiles[0] === 'owner-1' ? { ...record, type: 'moderator' } : record
  )
  const { service, collections } = createDomainHarness({
    userProfiles: { ownerUser: ['owner-1'] },
    relationships: original,
    beforeTransaction(_names, current) {
      current.set('community_relationships', afterTransfer)
    }
  })

  await assert.rejects(
    service.demoteModerator('ownerUser', communityId, 'moderator-1', 'owner-1'),
    error => error.getStatus() === 403 && error.message === 'ONLY_OWNER_CAN_DEMOTE_MODERATOR'
  )
  assert.deepEqual(collections.get('community_relationships'), afterTransfer)
})

test('transferring community ownership rechecks the current owner role transactionally', async () => {
  const original = [
    relationship('owner-1', 'owner'),
    relationship('moderator-1', 'moderator')
  ]
  const afterTransfer = original.map(record =>
    record.profiles[0] === 'owner-1' ? { ...record, type: 'moderator' } : record
  )
  const { service, collections } = createDomainHarness({
    userProfiles: { ownerUser: ['owner-1'] },
    relationships: original,
    beforeTransaction(_names, current) {
      current.set('community_relationships', afterTransfer)
    }
  })

  await assert.rejects(
    service.transferOwnership('ownerUser', communityId, 'moderator-1', 'owner-1'),
    error => error.getStatus() === 403 && error.message === 'OWNERSHIP_TRANSFER_NOT_ALLOWED'
  )
  assert.deepEqual(collections.get('community_relationships'), afterTransfer)
})

test('private community member details are not returned after membership is revoked before the read snapshot', async () => {
  const { service, collections } = createDomainHarness({
    privacy: 'private',
    userProfiles: { memberUser: ['member-1'] },
    relationships: [
      relationship('owner-1', 'owner'),
      relationship('member-1', 'connection')
    ],
    beforeTransaction(_names, current) {
      current.set('community_relationships', [relationship('owner-1', 'owner')])
    }
  })
  await assert.rejects(
    service.listCommunityMembers(communityId, 'all', page, 'memberUser'),
    error => error.getStatus() === 404 && error.message === 'COMMUNITY_NOT_FOUND'
  )
})

test('staff-only member tabs recheck the actor role in the member-list snapshot', async () => {
  const { service, collections } = createDomainHarness({
    userProfiles: { moderatorUser: ['moderator-1'] },
    relationships: [
      relationship('owner-1', 'owner'),
      relationship('moderator-1', 'moderator'),
      relationship('banned-1', 'blocked')
    ],
    beforeTransaction(_names, current) {
      current.set('community_relationships', [
        relationship('owner-1', 'owner'),
        relationship('moderator-1', 'connection'),
        relationship('banned-1', 'blocked')
      ])
    }
  })
  await assert.rejects(
    service.listCommunityMembers(communityId, 'banned', page, 'moderatorUser', 'moderator-1'),
    error => error.getStatus() === 403 && error.message === 'COMMUNITY_STAFF_REQUIRED'
  )
})

test('pending member lists recheck staff role in the same snapshot as pending requests', async () => {
  const { service } = createDomainHarness({
    userProfiles: { moderatorUser: ['moderator-1'] },
    relationships: [
      relationship('owner-1', 'owner'),
      relationship('moderator-1', 'moderator'),
      relationship('pending-1', 'requested')
    ],
    beforeTransaction(_names, current) {
      current.set('community_relationships', [
        relationship('owner-1', 'owner'),
        relationship('moderator-1', 'connection'),
        relationship('pending-1', 'requested')
      ])
    }
  })
  await assert.rejects(
    service.listPendingMembers('moderatorUser', communityId, 'moderator-1', page),
    error => error.getStatus() === 403 && error.message === 'COMMUNITY_STAFF_REQUIRED'
  )
})

