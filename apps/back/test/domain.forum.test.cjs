const test = require('node:test')
const assert = require('node:assert/strict')
const { DomainService } = require('../dist/api/domain/domain.service.js')

const communityId = 'community-1'
const profiles = [
  { id: 'owner', name: 'Owner', url: 'owner', picture: '', about: '', type: 'rp' },
  { id: 'member', name: 'Member', url: 'member', picture: '', about: '', type: 'rp' },
  { id: 'other', name: 'Other', url: 'other', picture: '', about: '', type: 'social' }
]
const community = { id: communityId, name: 'Forum', url: 'forum', picture: '', about: '', type: 'rp' }
const page = { page: 1, pageSize: 20 }
const relationship = (id, type) => ({ profiles: [id, communityId], type, requestedBy: null, blockedBy: null, updatedAt: 1 })

function harness(owned = {}, uploads = null, beforeTransaction) {
  const collections = new Map([
    ['accounts', Object.entries(owned).map(([id, ids]) => ({
      id,
      email: id + '@example.com',
      profiles: [...ids],
      currentProfile: ids[0] ?? null
    }))],
    ['profiles', profiles],
    ['communities', [community]],
    ['community_relationships', [relationship('owner', 'owner'), relationship('member', 'connection')]],
    ['community_forum_topics', []],
    ['community_forum_replies', []],
    ['profile_messages', []],
    ['media_files', []],
    ['relationships', []]
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
      const records = Object.fromEntries(names.map(name => [
        name,
        structuredClone(collections.get(name) ?? [])
      ]))
      const outcome = updater(records)
      for (const name of names) {
        if (!Array.isArray(outcome.records[name])) throw new Error('INVALID_TRANSACTION_RECORDS')
      }
      for (const name of names) collections.set(name, structuredClone(outcome.records[name]))
      return structuredClone(outcome.result)
    }
  }
  const auth = {
    async getUser(id) { const ids = owned[id] ?? []; return { id, email: id + '@example.com', profiles: ids, currentProfile: ids[0] ?? null } },
    async ownsProfile(id, profileId) { return (owned[id] ?? []).includes(profileId) },
    async addProfile() {}
  }
  return { service: new DomainService(data, auth, uploads), collections }
}

test('forum members can publish and read topics with paginated replies', async () => {
  const { service } = harness({ memberUser: ['member'] })
  const topic = await service.createCommunityForumTopic('memberUser', communityId, 'member', '  First   topic ', 'First post')
  assert.equal(topic.title, 'First topic')
  const reply = await service.createCommunityForumReply('memberUser', communityId, topic.id, 'member', 'A reply')
  const listing = await service.listCommunityForumTopics(communityId, page)
  assert.equal(listing.totalItems, 1)
  assert.equal(listing.items[0].replyCount, 1)
  const detail = await service.getCommunityForumTopic(communityId, topic.id, page)
  assert.equal(detail.replies.items[0].id, reply.id)
})

test('forum content attaches editor images and detaches them when content is deleted', async () => {
  const calls = []
  const uploads = {
    attachEditorImagesToRecords(records, userId, html, resourceType, resourceId) {
      calls.push({ operation: 'attach', userId, html, resourceType, resourceId })
      return records
    },
    detachResourceAttachmentsFromRecords(records, userId, resources) {
      for (const resource of resources) {
        calls.push({
          operation: 'detach',
          userId,
          resourceType: resource.resourceType,
          resourceId: resource.resourceId
        })
      }
      return records
    }
  }
  const { service } = harness({ memberUser: ['member'] }, uploads)
  const topicContent = '<p>Forum topic</p><img src="/api/uploads/123e4567-e89b-42d3-a456-426614174000/content">'
  const firstReplyContent = '<p>First reply</p><img src="/api/uploads/223e4567-e89b-42d3-a456-426614174000/content">'
  const secondReplyContent = '<p>Second reply</p><img src="/api/uploads/323e4567-e89b-42d3-a456-426614174000/content">'

  const topic = await service.createCommunityForumTopic('memberUser', communityId, 'member', 'Topic with image', topicContent)
  const firstReply = await service.createCommunityForumReply('memberUser', communityId, topic.id, 'member', firstReplyContent)
  await service.deleteCommunityForumReply('memberUser', communityId, firstReply.id, 'member')

  const secondReply = await service.createCommunityForumReply('memberUser', communityId, topic.id, 'member', secondReplyContent)
  await service.deleteCommunityForumTopic('memberUser', communityId, topic.id, 'member')

  assert.equal(calls.some(call => call.operation === 'attach' && call.resourceType === 'community-forum-topic' && call.resourceId === topic.id), true)
  assert.equal(calls.some(call => call.operation === 'attach' && call.resourceType === 'community-forum-reply' && call.resourceId === firstReply.id), true)
  assert.equal(calls.some(call => call.operation === 'attach' && call.resourceType === 'community-forum-reply' && call.resourceId === secondReply.id), true)
  assert.equal(calls.some(call => call.operation === 'detach' && call.resourceType === 'community-forum-reply' && call.resourceId === firstReply.id), true)
  assert.equal(calls.some(call => call.operation === 'detach' && call.resourceType === 'community-forum-topic' && call.resourceId === topic.id), true)
  assert.equal(calls.some(call => call.operation === 'detach' && call.resourceType === 'community-forum-reply' && call.resourceId === secondReply.id), true)
})

test('forum rejects non-members, cross-type profiles, and replies to locked topics', async () => {
  const { service } = harness({ otherUser: ['other'], memberUser: ['member'], ownerUser: ['owner'] })
  await assert.rejects(service.createCommunityForumTopic('otherUser', communityId, 'other', 'Topic', 'Content'),
    error => error.getStatus() === 403 && error.message === 'PROFILE_TYPE_MISMATCH')
  const topic = await service.createCommunityForumTopic('memberUser', communityId, 'member', 'Topic', 'Content')
  await service.moderateCommunityForumTopic('ownerUser', communityId, topic.id, 'owner', { isLocked: true, isPinned: true })
  await assert.rejects(service.createCommunityForumReply('memberUser', communityId, topic.id, 'member', 'Reply'),
    error => error.getStatus() === 403 && error.message === 'FORUM_TOPIC_LOCKED')
})

test('friend requests cannot cross profile types', async () => {
  const { service } = harness({ memberUser: ['member'] })
  await assert.rejects(service.updateProfileRelationship('memberUser', 'member', 'other', 'requested'),
    error => error.getStatus() === 403 && error.message === 'PROFILE_TYPE_MISMATCH')
})

test('community type inherits from the owner profile', async () => {
  const { service, collections } = harness({ ownerUser: ['owner'] })
  const created = await service.createCommunity('ownerUser', 'owner', { name: 'Inherited', url: 'inherited', picture: '', about: '' })
  assert.equal(created.type, 'rp')
  assert.equal(collections.get('communities').find(item => item.id === created.id).type, 'rp')
})

test('profile update preserves the original type even if a caller sends one at runtime', async () => {
  const { service } = harness({ memberUser: ['member'] })
  const updated = await service.updateProfile('memberUser', 'member', {
    name: 'Changed', url: 'member', picture: '', about: '', type: 'social'
  })
  assert.equal(updated.type, 'rp')
})

test('legacy community type is normalized to its owner profile type', async () => {
  const { service, collections } = harness()
  collections.set('communities', [{ ...community, type: 'social' }])
  const normalized = await service.getCommunity('forum')
  assert.equal(normalized.type, 'rp')
  assert.equal(collections.get('communities')[0].type, 'rp')
})

test('a user cannot interact through an owned profile with a type different from the active profile', async () => {
  const { service } = harness({ memberUser: ['other', 'member'] })
  await assert.rejects(
    service.updateProfileRelationship('memberUser', 'member', 'owner', 'requested'),
    error => error.getStatus() === 403 && error.message === 'PROFILE_TYPE_MISMATCH'
  )
})

test('a community owner can publish through an owned profile while another profile is active', async () => {
  const { service } = harness({ multiProfileUser: ['other', 'owner'] })
  const relationships = await service.getCommunityRelationships('multiProfileUser', communityId)

  assert.equal(relationships.some(record => record.profiles[0] === 'owner' && record.type === 'owner'), true)
  assert.equal(relationships.some(record => record.profiles[0] === 'other'), false)

  const topic = await service.createCommunityForumTopic('multiProfileUser', communityId, 'owner', 'Owner topic', 'Owner post')
  const reply = await service.createCommunityForumReply('multiProfileUser', communityId, topic.id, 'owner', 'Owner reply')

  assert.ok(topic.id)
  assert.ok(reply.id)
})


test('forum topic creation rechecks membership when committing the topic', async () => {
  const { service, collections } = harness(
    { memberUser: ['member'] },
    null,
    (names, current) => {
      if (names.includes('community_forum_topics')) {
        current.set('community_relationships', [relationship('owner', 'owner')])
      }
    }
  )

  await assert.rejects(
    service.createCommunityForumTopic('memberUser', communityId, 'member', 'Topic', 'Content'),
    error => error.getStatus() === 403 && error.message === 'COMMUNITY_MEMBER_REQUIRED'
  )
  assert.deepEqual(collections.get('community_forum_topics'), [])
})

test('forum moderation rechecks staff role in the topic transaction', async () => {
  let revokeStaff = false
  const { service, collections } = harness(
    { ownerUser: ['owner'] },
    null,
    (names, current) => {
      if (revokeStaff && names.includes('community_forum_topics')) {
        current.set('community_relationships', [
          relationship('owner', 'connection'),
          relationship('member', 'connection')
        ])
      }
    }
  )
  const topic = await service.createCommunityForumTopic(
    'ownerUser', communityId, 'owner', 'Topic', 'Content'
  )
  revokeStaff = true

  await assert.rejects(
    service.moderateCommunityForumTopic(
      'ownerUser', communityId, topic.id, 'owner', { isPinned: true }
    ),
    error => error.getStatus() === 403 && error.message === 'COMMUNITY_STAFF_REQUIRED'
  )
  assert.equal(collections.get('community_forum_topics')[0].isPinned, false)
})

test('forum replies recheck membership and topic lock in the same transaction', async () => {
  let removeMembership = false
  const { service, collections } = harness(
    { memberUser: ['member'] },
    null,
    (names, current) => {
      if (removeMembership && names.includes('community_forum_replies')) {
        current.set('community_relationships', [relationship('owner', 'owner')])
      }
    }
  )
  const topic = await service.createCommunityForumTopic(
    'memberUser', communityId, 'member', 'Topic', 'Content'
  )
  removeMembership = true

  await assert.rejects(
    service.createCommunityForumReply('memberUser', communityId, topic.id, 'member', 'Reply'),
    error => error.getStatus() === 403 && error.message === 'COMMUNITY_MEMBER_REQUIRED'
  )
  assert.deepEqual(collections.get('community_forum_replies'), [])
})


test('friend-request creation rechecks source-profile ownership in the relationship transaction', async () => {
  const { service, collections } = harness(
    { memberUser: ['member'] },
    null,
    (names, current) => {
      if (names.includes('relationships')) current.set('accounts', [])
    }
  )

  await assert.rejects(
    service.updateProfileRelationship('memberUser', 'member', 'owner', 'requested'),
    error => error.getStatus() === 403 && error.message === 'PROFILE_NOT_OWNED'
  )
  assert.deepEqual(collections.get('relationships'), [])
})

test('sending a profile message rechecks sender ownership in the message transaction', async () => {
  const { service, collections } = harness(
    { memberUser: ['member'] },
    null,
    (names, current) => {
      if (names.includes('profile_messages')) current.set('accounts', [])
    }
  )

  await assert.rejects(
    service.sendMessage('memberUser', 'member', 'owner', 'Hello'),
    error => error.getStatus() === 403 && error.message === 'PROFILE_NOT_OWNED'
  )
  assert.deepEqual(collections.get('profile_messages'), [])
})

test('private forum listing reads membership and topics from the same snapshot', async () => {
  const { service, collections } = harness(
    { memberUser: ['member'] },
    null,
    (names, current) => {
      if (names.includes('community_forum_topics')) {
        current.set('communities', [{ ...community, privacy: 'private' }])
        current.set('community_relationships', [relationship('owner', 'owner')])
      }
    }
  )
  collections.set('communities', [{ ...community, privacy: 'private' }])

  await assert.rejects(
    service.listCommunityForumTopics(communityId, page, 'memberUser'),
    error => error.getStatus() === 404 && error.message === 'COMMUNITY_NOT_FOUND'
  )
})

