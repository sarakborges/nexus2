const assert = require('node:assert/strict')
const { test } = require('node:test')
const { DomainAccessService } = require('../dist/api/domain/domain-access.service.js')
const { CommunityPageService } = require('../dist/api/domain/community-page.service.js')

const records = {
  accounts: [{
    id: 'viewer-1',
    email: 'viewer@example.com',
    profiles: ['profile-owner', 'profile-moderator'],
    currentProfile: 'profile-owner',
    password: { hash: 'hash', salt: 'salt' }
  }],
  profiles: [
    { id: 'profile-owner', name: 'Owner', url: 'owner', picture: '', about: '', type: 'social' },
    { id: 'profile-moderator', name: 'Moderator', url: 'moderator', picture: '', about: '', type: 'social' },
    { id: 'profile-pending', name: 'Pending', url: 'pending', picture: '', about: '', type: 'social' },
    { id: 'profile-member', name: 'Member', url: 'member', picture: '', about: '', type: 'social' },
    { id: 'profile-other-type', name: 'Other type', url: 'other-type', picture: '', about: '', type: 'rp' }
  ],
  communities: [
    { id: 'community-1', name: 'Community', url: 'community', picture: '/picture.png', about: '<p>About</p>', type: 'social', privacy: 'public' }
  ],
  community_relationships: [
    { profiles: ['profile-owner', 'community-1'], type: 'owner', requestedBy: null, blockedBy: null, updatedAt: 500 },
    { profiles: ['profile-moderator', 'community-1'], type: 'moderator', requestedBy: null, blockedBy: null, updatedAt: 400 },
    { profiles: ['profile-pending', 'community-1'], type: 'requested', requestedBy: 'profile-pending', blockedBy: null, updatedAt: 300 },
    { profiles: ['profile-member', 'community-1'], type: 'connection', requestedBy: null, blockedBy: null, updatedAt: 200 },
    { profiles: ['profile-other-type', 'community-1'], type: 'blocked', requestedBy: null, blockedBy: 'profile-owner', updatedAt: 100 }
  ],
  community_forum_topics: [
    { id: 'topic-1', communityId: 'community-1', profileId: 'profile-member', title: 'Latest topic', content: '<p>Topic</p>', createdAt: 100, updatedAt: 900, isPinned: false, isLocked: false },
    { id: 'topic-2', communityId: 'community-1', profileId: 'profile-owner', title: 'Pinned topic', content: '<p>Pinned</p>', createdAt: 100, updatedAt: 700, isPinned: true, isLocked: false },
    { id: 'topic-other', communityId: 'other-community', profileId: 'profile-owner', title: 'Other', content: '', createdAt: 1, updatedAt: 1, isPinned: false, isLocked: false }
  ],
  community_forum_replies: [
    { id: 'reply-1', topicId: 'topic-1', communityId: 'community-1', profileId: 'profile-owner', content: '<p>Reply</p>', createdAt: 110, updatedAt: 110 }
  ]
}

function createRepository(initialRecords = records) {
  let transactionCalls = 0
  return {
    get transactionCalls() { return transactionCalls },
    async transaction(collections, updater) {
      transactionCalls += 1
      assert.deepEqual(collections, [
        'accounts',
        'profiles',
        'communities',
        'community_relationships',
        'community_forum_topics',
        'community_forum_replies'
      ])
      const outcome = updater(structuredClone(initialRecords))
      return outcome.result
    }
  }
}

test('community page aggregate includes access, member count, pending count and forum authors in one transaction', async () => {
  const repository = createRepository()
  const access = new DomainAccessService(repository)
  const service = new CommunityPageService(repository, access)

  const result = await service.getCommunityPage('@COMMUNITY', 'viewer-1')

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.community.id, 'community-1')
  assert.equal(result.canViewMembers, true)
  assert.equal(result.canEditCommunity, true)
  assert.equal(result.pendingRequestCount, 1)
  assert.deepEqual(
    result.members.items.map(profile => profile.id),
    ['profile-owner', 'profile-moderator', 'profile-member']
  )
  assert.equal(result.members.totalItems, 3)
  assert.deepEqual(
    result.forumTopics.items.map(topic => topic.id),
    ['topic-2', 'topic-1']
  )
  assert.equal(result.forumTopics.items[1].replyCount, 1)
  assert.deepEqual(
    result.forumAuthors.map(profile => profile.id).sort(),
    ['profile-member', 'profile-owner']
  )
  assert.deepEqual(
    result.relationships.map(relationship => relationship.type),
    ['owner', 'moderator']
  )
})

test('private community aggregate redacts content and omits protected previews for non-members', async () => {
  const privateRecords = structuredClone(records)
  privateRecords.accounts[0].profiles = []
  privateRecords.accounts[0].currentProfile = null
  privateRecords.communities[0].privacy = 'private'
  const repository = createRepository(privateRecords)
  const access = new DomainAccessService(repository)
  const service = new CommunityPageService(repository, access)

  const result = await service.getCommunityPage('community', 'viewer-1')

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.community.privacy, 'private')
  assert.equal(result.community.picture, '')
  assert.equal(result.community.about, '')
  assert.equal(result.canViewMembers, false)
  assert.equal(result.canEditCommunity, false)
  assert.equal(result.pendingRequestCount, 0)
  assert.deepEqual(result.members.items, [])
  assert.deepEqual(result.forumTopics.items, [])
  assert.deepEqual(result.forumAuthors, [])
})

test('community page aggregate returns null for an unknown community url', async () => {
  const repository = createRepository()
  const access = new DomainAccessService(repository)
  const service = new CommunityPageService(repository, access)

  const result = await service.getCommunityPage('missing', null)

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.community, null)
  assert.deepEqual(result.members.items, [])
  assert.deepEqual(result.forumTopics.items, [])
})

test('unlisted community aggregate remains readable for visitors without a session', async () => {
  const unlistedRecords = structuredClone(records)
  unlistedRecords.communities[0].privacy = 'unlisted'
  const repository = createRepository(unlistedRecords)
  const access = new DomainAccessService(repository)
  const service = new CommunityPageService(repository, access)

  const result = await service.getCommunityPage('community', null)

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.canViewMembers, true)
  assert.equal(result.canEditCommunity, false)
  assert.equal(result.pendingRequestCount, 0)
  assert.equal(result.community.picture, '/picture.png')
  assert.equal(result.members.totalItems, 3)
  assert.equal(result.forumTopics.totalItems, 2)
  assert.deepEqual(result.relationships, [])
})
