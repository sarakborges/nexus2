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

function harness(owned = {}) {
  const collections = new Map([
    ['profiles', profiles],
    ['communities', [community]],
    ['community_relationships', [relationship('owner', 'owner'), relationship('member', 'connection')]],
    ['community_forum_topics', []],
    ['community_forum_replies', []],
    ['relationships', []]
  ])
  const data = {
    async read(name) { return structuredClone(collections.get(name) ?? []) },
    async write(name, rows) { collections.set(name, structuredClone(rows)) }
  }
  const auth = {
    async getUser(id) { const ids = owned[id] ?? []; return { id, email: id + '@example.com', profiles: ids, currentProfile: ids[0] ?? null } },
    async ownsProfile(id, profileId) { return (owned[id] ?? []).includes(profileId) },
    async addProfile() {}
  }
  return { service: new DomainService(data, auth), collections }
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
