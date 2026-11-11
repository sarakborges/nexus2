const assert = require('node:assert/strict')
const { test } = require('node:test')
const { DomainAccessService } = require('../dist/api/domain/domain-access.service.js')
const { CommunityForumTopicPageService } = require('../dist/api/domain/community-forum-topic-page.service.js')

const records = {
  accounts: [{
    id: 'viewer-1',
    email: 'viewer@example.com',
    profiles: ['profile-owner', 'profile-moderator'],
    currentProfile: 'profile-moderator',
    password: { hash: 'hash', salt: 'salt' }
  }],
  profiles: [
    { id: 'profile-owner', name: 'Owner', url: 'owner', picture: '', about: '', type: 'social' },
    { id: 'profile-moderator', name: 'Moderator', url: 'moderator', picture: '', about: '', type: 'social' },
    { id: 'profile-member', name: 'Member', url: 'member', picture: '', about: '', type: 'social' },
    { id: 'profile-pending', name: 'Pending', url: 'pending', picture: '', about: '', type: 'social' },
    { id: 'profile-other-type', name: 'Other type', url: 'other-type', picture: '', about: '', type: 'rp' }
  ],
  communities: [
    { id: 'community-1', name: 'Community', url: 'community', picture: '/picture.png', about: '<p>About</p>', type: 'social', privacy: 'public' }
  ],
  community_relationships: [
    { profiles: ['profile-owner', 'community-1'], type: 'owner', requestedBy: null, blockedBy: null, updatedAt: 500 },
    { profiles: ['profile-moderator', 'community-1'], type: 'moderator', requestedBy: null, blockedBy: null, updatedAt: 400 },
    { profiles: ['profile-member', 'community-1'], type: 'connection', requestedBy: null, blockedBy: null, updatedAt: 300 },
    { profiles: ['profile-pending', 'community-1'], type: 'requested', requestedBy: 'profile-pending', blockedBy: null, updatedAt: 200 },
    { profiles: ['profile-other-type', 'community-1'], type: 'blocked', requestedBy: null, blockedBy: 'profile-other-type', updatedAt: 100 }
  ],
  community_forum_topics: [
    { id: 'topic-1', communityId: 'community-1', profileId: 'profile-owner', title: 'Topic', content: '<p>Topic body</p>', createdAt: 100, updatedAt: 500, isPinned: false, isLocked: false },
    { id: 'topic-other', communityId: 'other-community', profileId: 'profile-owner', title: 'Other', content: '', createdAt: 1, updatedAt: 1, isPinned: false, isLocked: false }
  ],
  community_forum_replies: [
    ...Array.from({ length: 21 }, (_, index) => ({
      id: 'reply-' + (index + 1),
      topicId: 'topic-1',
      communityId: 'community-1',
      profileId: ['profile-member', 'profile-moderator', 'profile-owner'][index % 3],
      content: '<p>Reply ' + (index + 1) + '</p>',
      createdAt: (index + 1) * 100,
      updatedAt: (index + 1) * 100
    })),
    { id: 'reply-other', topicId: 'topic-other', communityId: 'other-community', profileId: 'profile-owner', content: '<p>Other</p>', createdAt: 4000, updatedAt: 4000 }
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

function createService(repository) {
  const access = new DomainAccessService(repository)
  return new CommunityForumTopicPageService(repository, access)
}

test('forum topic page aggregate includes community, access, current reply page and authors in one transaction', async () => {
  const repository = createRepository()
  const service = createService(repository)

  const result = await service.getCommunityForumTopicPage(
    '@COMMUNITY',
    'topic-1',
    { page: 1, pageSize: 2 },
    'viewer-1'
  )

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.community.id, 'community-1')
  assert.equal(result.isMember, true)
  assert.equal(result.viewerRelationship.type, 'moderator')
  assert.equal(result.currentProfileType, 'social')
  assert.equal(result.isStaff, true)
  assert.equal(result.forumProfileId, 'profile-moderator')
  assert.equal(result.detail.topic.replyCount, 21)
  assert.equal(result.detail.replies.items.length, 20)
  assert.deepEqual(
    result.detail.replies.items.slice(0, 2).map(reply => reply.id),
    ['reply-1', 'reply-2']
  )
  assert.deepEqual(
    result.authors.map(profile => profile.id).sort(),
    ['profile-member', 'profile-moderator', 'profile-owner']
  )
})

test('forum topic page aggregate returns authors only for the selected reply page', async () => {
  const repository = createRepository()
  const service = createService(repository)

  const result = await service.getCommunityForumTopicPage(
    'community',
    'topic-1',
    { page: 2, pageSize: 2 },
    'viewer-1'
  )

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.detail.replies.page, 2)
  assert.equal(result.detail.replies.totalItems, 21)
  assert.deepEqual(
    result.detail.replies.items.map(reply => reply.id),
    ['reply-21']
  )
  assert.deepEqual(result.authors.map(profile => profile.id), ['profile-owner'])
})

test('active profile type mismatch is preserved when another owned profile can access the forum', async () => {
  const mismatchedRecords = structuredClone(records)
  mismatchedRecords.accounts[0].profiles.push('profile-other-type')
  mismatchedRecords.accounts[0].currentProfile = 'profile-other-type'
  const repository = createRepository(mismatchedRecords)
  const service = createService(repository)

  const result = await service.getCommunityForumTopicPage(
    'community',
    'topic-1',
    { page: 1, pageSize: 20 },
    'viewer-1'
  )

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.currentProfileType, 'rp')
  assert.equal(result.viewerRelationship, null)
  assert.equal(result.forumProfileId, 'profile-owner')
  assert.equal(result.isMember, true)
})

test('public topic page is readable by anonymous visitors without forum membership', async () => {
  const repository = createRepository()
  const service = createService(repository)

  const result = await service.getCommunityForumTopicPage(
    'community',
    'topic-1',
    { page: 1, pageSize: 20 },
    null
  )

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.isMember, false)
  assert.equal(result.viewerRelationship, null)
  assert.equal(result.currentProfileType, null)
  assert.equal(result.isStaff, false)
  assert.equal(result.forumProfileId, null)
  assert.equal(result.detail.topic.id, 'topic-1')
})

test('private topic page hides the resource from non-members', async () => {
  const privateRecords = structuredClone(records)
  privateRecords.communities[0].privacy = 'private'
  privateRecords.accounts[0].profiles = []
  privateRecords.accounts[0].currentProfile = null
  const repository = createRepository(privateRecords)
  const service = createService(repository)

  await assert.rejects(
    () => service.getCommunityForumTopicPage(
      'community',
      'topic-1',
      { page: 1, pageSize: 20 },
      'viewer-1'
    ),
    error => error.getStatus() === 404 && error.message === 'COMMUNITY_NOT_FOUND'
  )
  assert.equal(repository.transactionCalls, 1)
})

test('forum topic page aggregate rejects a topic that belongs to another community', async () => {
  const repository = createRepository()
  const service = createService(repository)

  await assert.rejects(
    () => service.getCommunityForumTopicPage(
      'community',
      'topic-other',
      { page: 1, pageSize: 20 },
      null
    ),
    error => error.getStatus() === 404 && error.message === 'FORUM_TOPIC_NOT_FOUND'
  )
  assert.equal(repository.transactionCalls, 1)
})
