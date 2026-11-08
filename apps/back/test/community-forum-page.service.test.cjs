const assert = require('node:assert/strict')
const { test } = require('node:test')
const { DomainAccessService } = require('../dist/api/domain/domain-access.service.js')
const { CommunityForumPageService } = require('../dist/api/domain/community-forum-page.service.js')

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
    { id: 'topic-latest', communityId: 'community-1', profileId: 'profile-member', title: 'Latest', content: '<p>Latest</p>', createdAt: 200, updatedAt: 900, isPinned: false, isLocked: false },
    { id: 'topic-pinned', communityId: 'community-1', profileId: 'profile-owner', title: 'Pinned', content: '<p>Pinned</p>', createdAt: 100, updatedAt: 700, isPinned: true, isLocked: false },
    { id: 'topic-other', communityId: 'other-community', profileId: 'profile-owner', title: 'Other community', content: '', createdAt: 1, updatedAt: 1, isPinned: false, isLocked: false }
  ],
  community_forum_replies: [
    { id: 'reply-1', topicId: 'topic-latest', communityId: 'community-1', profileId: 'profile-owner', content: '<p>Reply</p>', createdAt: 210, updatedAt: 210 },
    { id: 'reply-2', topicId: 'topic-latest', communityId: 'community-1', profileId: 'profile-moderator', content: '<p>Reply two</p>', createdAt: 220, updatedAt: 220 }
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
  return new CommunityForumPageService(repository, access)
}

test('forum page aggregate returns topics, reply counts and authors in one transaction', async () => {
  const repository = createRepository()
  const service = createService(repository)

  const result = await service.getCommunityForumPage(
    '@COMMUNITY',
    { page: 1, pageSize: 20 },
    'viewer-1'
  )

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.community.id, 'community-1')
  assert.equal(result.canReadForum, true)
  assert.equal(result.canPublish, true)
  assert.deepEqual(
    result.topics.items.map(topic => topic.id),
    ['topic-pinned', 'topic-latest']
  )
  assert.equal(result.topics.items[1].replyCount, 2)
  assert.deepEqual(
    result.authors.map(profile => profile.id).sort(),
    ['profile-member', 'profile-owner']
  )
})

test('forum page aggregate uses the requested pagination and only includes current-page authors', async () => {
  const pageRecords = structuredClone(records)
  pageRecords.community_forum_topics = Array.from({ length: 21 }, (_, index) => ({
    id: 'topic-' + String(index + 1).padStart(2, '0'),
    communityId: 'community-1',
    profileId: index === 20 ? 'profile-moderator' : 'profile-owner',
    title: 'Topic ' + (index + 1),
    content: '',
    createdAt: index + 1,
    updatedAt: index + 1,
    isPinned: false,
    isLocked: false
  }))
  const repository = createRepository(pageRecords)
  const service = createService(repository)

  const result = await service.getCommunityForumPage(
    'community',
    { page: 2, pageSize: 20 },
    'viewer-1'
  )

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.topics.page, 2)
  assert.equal(result.topics.totalItems, 21)
  assert.deepEqual(result.topics.items.map(topic => topic.id), ['topic-21'])
  assert.deepEqual(result.authors.map(profile => profile.id), ['profile-moderator'])
})

test('public forum page is readable by an anonymous visitor but cannot publish', async () => {
  const repository = createRepository()
  const service = createService(repository)

  const result = await service.getCommunityForumPage(
    'community',
    { page: 1, pageSize: 20 },
    null
  )

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.canReadForum, true)
  assert.equal(result.canPublish, false)
  assert.equal(result.community.picture, '/picture.png')
  assert.equal(result.topics.totalItems, 2)
})

test('private forum page redacts the community and hides topics from non-members', async () => {
  const privateRecords = structuredClone(records)
  privateRecords.accounts[0].profiles = []
  privateRecords.accounts[0].currentProfile = null
  privateRecords.communities[0].privacy = 'private'
  const repository = createRepository(privateRecords)
  const service = createService(repository)

  const result = await service.getCommunityForumPage(
    'community',
    { page: 1, pageSize: 20 },
    'viewer-1'
  )

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.canReadForum, false)
  assert.equal(result.canPublish, false)
  assert.equal(result.community.picture, '')
  assert.equal(result.community.about, '')
  assert.equal(result.topics.totalItems, 0)
  assert.deepEqual(result.authors, [])
})

test('unlisted forum page is readable without a session', async () => {
  const unlistedRecords = structuredClone(records)
  unlistedRecords.communities[0].privacy = 'unlisted'
  const repository = createRepository(unlistedRecords)
  const service = createService(repository)

  const result = await service.getCommunityForumPage(
    'community',
    { page: 1, pageSize: 20 },
    null
  )

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.canReadForum, true)
  assert.equal(result.canPublish, false)
  assert.equal(result.topics.totalItems, 2)
})
