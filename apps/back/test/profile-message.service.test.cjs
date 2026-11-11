const test = require('node:test')
const assert = require('node:assert/strict')
const { ForbiddenException } = require('@nestjs/common')
const { ProfileMessageService } = require('../dist/api/domain/profile-message.service.js')

function makeRepository() {
  const records = {
    accounts: [{ id: 'user-1', profiles: ['sender-1', 'recipient-1'] }],
    profile_messages: [{
      id: 'message-1',
      fromProfileId: 'sender-1',
      toProfileId: 'recipient-1',
      content: '<p>Hello</p>',
      createdAt: 123,
      isFavorite: false
    }],
    media_files: []
  }

  return {
    records,
    async transaction(_collections, updater) {
      const outcome = updater(records)
      if (outcome.records) {
        for (const [key, value] of Object.entries(outcome.records)) records[key] = value
      }
      return outcome.result
    }
  }
}

test('sender may delete their own message', async () => {
  const repository = makeRepository()
  const service = new ProfileMessageService(repository, {})
  await service.deleteMessage('user-1', 'recipient-1', 'message-1', 'sender-1')
  assert.equal(repository.records.profile_messages.length, 0)
})

test('recipient may delete a received message', async () => {
  const repository = makeRepository()
  const service = new ProfileMessageService(repository, {})
  await service.deleteMessage('user-1', 'recipient-1', 'message-1', 'recipient-1')
  assert.equal(repository.records.profile_messages.length, 0)
})

test('unrelated owned profile cannot delete someone else’s message', async () => {
  const repository = makeRepository()
  repository.records.accounts[0].profiles.push('unrelated')
  const service = new ProfileMessageService(repository, {})
  await assert.rejects(
    service.deleteMessage('user-1', 'recipient-1', 'message-1', 'unrelated'),
    error => error instanceof ForbiddenException
  )
})

test('recipient can favorite without changing the message timestamp', async () => {
  const repository = makeRepository()
  const service = new ProfileMessageService(repository, {})
  const result = await service.setMessageFavorite('user-1', 'recipient-1', 'message-1', 'recipient-1', true)
  assert.equal(result.isFavorite, true)
  assert.equal(result.createdAt, 123)
})

test('sender cannot favorite a message received by another profile', async () => {
  const repository = makeRepository()
  const service = new ProfileMessageService(repository, {})
  await assert.rejects(
    service.setMessageFavorite('user-1', 'recipient-1', 'message-1', 'sender-1', true),
    error => error instanceof ForbiddenException
  )
})


function createSendService({ audience = 'everyone', senderOwnsRecipient = false, isFriend = false } = {}) {
  const sender = { id: 'sender', name: 'Sender', url: 'sender', picture: '', about: '', type: 'social' }
  const recipient = { id: 'recipient', name: 'Recipient', url: 'recipient', picture: '', about: '', type: 'social' }
  const records = {
    accounts: [{ id: 'user-1', profiles: senderOwnsRecipient ? ['sender', 'recipient'] : ['sender'] }],
    profiles: [sender, recipient],
    profile_messages: [],
    media_files: [],
    relationships: isFriend ? [{ profiles: ['sender', 'recipient'], type: 'connection' }] : [],
    profile_settings: audience ? [{ profileId: 'recipient', messageAudience: audience }] : []
  }
  const repository = {
    async transaction(_collections, updater) {
      const outcome = updater(records)
      if (outcome.records) Object.assign(records, outcome.records)
      return outcome.result
    }
  }
  const access = {
    assertOwnsInRecords(userId, profileId, accounts) {
      if (userId !== 'user-1' || !accounts[0].profiles.includes(profileId)) throw new ForbiddenException()
    },
    assertSameType() {},
    touchProfilesActivity(profiles) { return profiles }
  }
  return new ProfileMessageService(repository, access)
}

test('message settings default to allowing everyone for existing profiles', async () => {
  const service = createSendService({ audience: undefined })
  const message = await service.sendMessage('user-1', 'sender', 'recipient', '<p>Hello</p>')
  assert.equal(message.toProfileId, 'recipient')
})

test('friends-only message setting blocks non-friends', async () => {
  const service = createSendService({ audience: 'friends' })
  await assert.rejects(
    service.sendMessage('user-1', 'sender', 'recipient', '<p>Hello</p>'),
    error => error instanceof ForbiddenException && error.message === 'PROFILE_MESSAGE_FRIENDS_ONLY'
  )
})

test('friends-only message setting allows connected profiles', async () => {
  const service = createSendService({ audience: 'friends', isFriend: true })
  const message = await service.sendMessage('user-1', 'sender', 'recipient', '<p>Hello</p>')
  assert.equal(message.toProfileId, 'recipient')
})

test('friends-only message setting allows another profile owned by the sender account', async () => {
  const service = createSendService({ audience: 'friends', senderOwnsRecipient: true })
  const message = await service.sendMessage('user-1', 'sender', 'recipient', '<p>Hello</p>')
  assert.equal(message.toProfileId, 'recipient')
})


test('profile message mutations use targeted relational writes without collection snapshots', async () => {
  const calls = []
  const created = {
    id: 'message-1',
    fromProfileId: 'sender',
    toProfileId: 'recipient',
    content: '<p>Hello</p>',
    createdAt: 123,
    isFavorite: false
  }
  const repository = {
    async createProfileMessage(change) {
      calls.push(['send', change])
      return created
    },
    async deleteProfileMessage(change) {
      calls.push(['delete', change])
    },
    async setProfileMessageFavorite(change) {
      calls.push(['favorite', change])
      return { ...created, isFavorite: change.isFavorite }
    },
    async transaction() {
      throw new Error('Profile message mutations must not use collection snapshots.')
    }
  }
  const uploads = { getEditorImageIds() { return ['image-1'] } }
  const service = new ProfileMessageService(repository, {}, uploads)

  const sent = await service.sendMessage('account-1', 'sender', 'recipient', '<p>Hello</p>')
  await service.deleteMessage('account-1', 'recipient', 'message-1', 'sender')
  const favorited = await service.setMessageFavorite(
    'account-1', 'recipient', 'message-1', 'recipient', true
  )

  assert.equal(sent.id, 'message-1')
  assert.equal(favorited.isFavorite, true)
  assert.deepEqual(calls.map(call => call[0]), ['send', 'delete', 'favorite'])
  assert.deepEqual(calls[0][1].imageIds, ['image-1'])
  assert.equal(calls[0][1].userId, 'account-1')
  assert.deepEqual(calls[1][1], {
    userId: 'account-1',
    recipientProfileId: 'recipient',
    messageId: 'message-1',
    actorProfileId: 'sender'
  })
  assert.equal(calls[2][1].isFavorite, true)
})

test('empty profile messages are rejected before the relational write', async () => {
  let writeCalled = false
  const repository = {
    async createProfileMessage() {
      writeCalled = true
      throw new Error('Invalid messages must not reach the relational write.')
    }
  }
  const service = new ProfileMessageService(repository, {})

  await assert.rejects(
    service.sendMessage('account-1', 'sender', 'recipient', '<p><br></p>'),
    error => error.message === 'INVALID_MESSAGE'
  )
  assert.equal(writeCalled, false)
})


test('private inbox reads use the paginated relational query instead of collection snapshots', async () => {
  const calls = []
  const repository = {
    async getProfileMessages(profileId, userId, page) {
      calls.push({ profileId, userId, page })
      return {
        items: [{
          id: 'message-1',
          fromProfileId: 'sender-1',
          toProfileId: profileId,
          content: '<p>Hello</p><script>bad()</script>',
          createdAt: 123,
          isFavorite: false
        }],
        page: 2,
        pageSize: 20,
        totalItems: 21,
        totalPages: 2
      }
    },
    async transaction() {
      throw new Error('Private inbox reads must not load collection snapshots.')
    }
  }
  const service = new ProfileMessageService(repository, {})

  const page = await service.getMessages('recipient-1', 'user-1', { page: 2 })

  assert.deepEqual(calls, [{ profileId: 'recipient-1', userId: 'user-1', page: 2 }])
  assert.equal(page.page, 2)
  assert.equal(page.totalItems, 21)
  assert.equal(page.items[0].content.includes('<script>'), false)
})
