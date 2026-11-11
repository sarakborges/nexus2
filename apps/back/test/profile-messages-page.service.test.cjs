const assert = require('node:assert/strict')
const { test } = require('node:test')
const { ProfileMessagesPageService } = require('../dist/api/domain/profile-messages-page.service.js')

const records = {
  accounts: [
    {
      id: 'owner-user',
      email: 'owner@example.com',
      profiles: ['profile-target'],
      currentProfile: 'profile-target',
      password: { hash: 'hash', salt: 'salt' }
    },
    {
      id: 'visitor-user',
      email: 'visitor@example.com',
      profiles: ['profile-sender'],
      currentProfile: 'profile-sender',
      password: { hash: 'hash', salt: 'salt' }
    }
  ],
  profiles: [
    { id: 'profile-target', name: 'Target', url: 'target', picture: '', about: '<p>Target</p>', type: 'social' },
    { id: 'profile-sender', name: 'Sender', url: 'sender', picture: '', about: '<p>Sender</p>', type: 'social' },
    { id: 'profile-other', name: 'Other', url: 'other', picture: '', about: '<p>Other</p>', type: 'social' }
  ],
  relationships: [{ profiles: ['profile-sender', 'profile-target'], type: 'connection', requestedBy: null, blockedBy: null, updatedAt: 150 }],
  profile_messages: [
    { id: 'message-1', fromProfileId: 'profile-sender', toProfileId: 'profile-target', content: '<p>From sender</p>', createdAt: 100 },
    { id: 'message-2', fromProfileId: 'profile-other', toProfileId: 'profile-target', content: '<p>From other</p>', createdAt: 200 },
    { id: 'message-3', fromProfileId: 'profile-sender', toProfileId: 'profile-other', content: '<p>For other recipient</p>', createdAt: 300 }
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
        'relationships',
        'profile_messages'
      ])
      const outcome = updater(structuredClone(initialRecords))
      return outcome.result
    }
  }
}

function createService(repository) {
  return new ProfileMessagesPageService(repository)
}

function query(overrides = {}) {
  return { page: 1, pageSize: 20, ...overrides }
}

test('profile messages aggregate returns profile, visible messages and sender profiles in one transaction for the owner', async () => {
  const repository = createRepository()
  const service = createService(repository)

  const result = await service.getProfileMessagesPage(
    '@TARGET',
    query(),
    'owner-user'
  )

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.profile.id, 'profile-target')
  assert.equal(result.viewerRelationship, null)
  assert.equal(result.currentProfileType, 'social')
  assert.equal(result.isProfileOwner, true)
  assert.deepEqual(
    result.messages.items.map(message => message.id),
    ['message-2', 'message-1']
  )
  assert.deepEqual(
    result.senders.map(profile => profile.id).sort(),
    ['profile-other', 'profile-sender']
  )
})

test('non-owner visitors only receive messages sent from profiles they own', async () => {
  const repository = createRepository()
  const service = createService(repository)

  const result = await service.getProfileMessagesPage(
    'target',
    query(),
    'visitor-user'
  )

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.isProfileOwner, false)
  assert.equal(result.viewerRelationship.type, 'connection')
  assert.equal(result.currentProfileType, 'social')
  assert.deepEqual(
    result.messages.items.map(message => message.id),
    ['message-1']
  )
  assert.deepEqual(
    result.senders.map(profile => profile.id),
    ['profile-sender']
  )
})

test('anonymous visitors do not receive private messages', async () => {
  const repository = createRepository()
  const service = createService(repository)

  const result = await service.getProfileMessagesPage(
    'target',
    query(),
    null
  )

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.isProfileOwner, false)
  assert.equal(result.viewerRelationship, null)
  assert.equal(result.currentProfileType, null)
  assert.equal(result.messages.totalItems, 0)
  assert.deepEqual(result.messages.items, [])
  assert.deepEqual(result.senders, [])
})

test('profile messages aggregate preserves pagination and only returns senders for the current page', async () => {
  const paginatedRecords = structuredClone(records)
  paginatedRecords.profile_messages = Array.from({ length: 21 }, (_, index) => ({
    id: 'message-' + String(index + 1).padStart(2, '0'),
    fromProfileId: index === 0 ? 'profile-other' : 'profile-sender',
    toProfileId: 'profile-target',
    content: '<p>Message ' + (index + 1) + '</p>',
    createdAt: (index + 1) * 100
  }))
  const repository = createRepository(paginatedRecords)
  const service = createService(repository)

  const result = await service.getProfileMessagesPage(
    'target',
    query({ page: 2 }),
    'owner-user'
  )

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.messages.page, 2)
  assert.equal(result.messages.totalItems, 21)
  assert.deepEqual(
    result.messages.items.map(message => message.id),
    ['message-01']
  )
  assert.deepEqual(
    result.senders.map(profile => profile.id),
    ['profile-other']
  )
})

test('profile messages aggregate returns empty data when the profile does not exist', async () => {
  const repository = createRepository()
  const service = createService(repository)

  const result = await service.getProfileMessagesPage(
    'missing',
    query({ page: 4 }),
    null
  )

  assert.equal(repository.transactionCalls, 1)
  assert.equal(result.profile, null)
  assert.equal(result.viewerRelationship, null)
  assert.equal(result.currentProfileType, null)
  assert.equal(result.isProfileOwner, false)
  assert.equal(result.messages.items.length, 0)
  assert.equal(result.messages.page, 1)
  assert.deepEqual(result.senders, [])
})


test('profile messages page uses a targeted read and sanitizes the visible messages and senders', async () => {
  const calls = []
  const result = {
    profile: {
      id: 'profile-1', name: 'Profile', url: 'profile', picture: '',
      about: '<p>Profile</p><script>unsafe()</script>', type: 'social',
      createdAt: 1, lastActivity: 2
    },
    viewerRelationship: null,
    currentProfileType: 'social',
    isProfileOwner: true,
    messageTab: 'all',
    messages: {
      items: [{
        id: 'message-1', fromProfileId: 'profile-2', toProfileId: 'profile-1',
        content: '<p>Hello</p><script>unsafe()</script>', createdAt: 2, isFavorite: false
      }],
      page: 1, pageSize: 20, totalItems: 1, totalPages: 1
    },
    senders: [{
      id: 'profile-2', name: 'Sender', url: 'sender', picture: '',
      about: '<p>Sender</p><script>unsafe()</script>', type: 'social',
      createdAt: 1, lastActivity: 2
    }],
    messagePermissions: {
      'message-1': { canDelete: true, canFavorite: true, canReply: true }
    }
  }
  const repository = {
    async getProfileMessagesPage(url, userId, page, query, sort, messageTab) {
      calls.push({ url, userId, page, query, sort, messageTab })
      return result
    },
    async transaction() {
      throw new Error('Profile messages page reads must not load collection snapshots.')
    }
  }
  const service = new ProfileMessagesPageService(repository)

  const page = await service.getProfileMessagesPage(
    '@PROFILE',
    { page: 2, query: 'hello', sort: 'name-desc', messageTab: 'favorites' },
    'account-1'
  )

  assert.deepEqual(calls, [{
    url: 'profile', userId: 'account-1', page: 2,
    query: 'hello', sort: 'name-desc', messageTab: 'favorites'
  }])
  assert.equal(page.profile.about.includes('<script>'), false)
  assert.equal(page.messages.items[0].content.includes('<script>'), false)
  assert.equal(page.senders[0].about.includes('<script>'), false)
})
