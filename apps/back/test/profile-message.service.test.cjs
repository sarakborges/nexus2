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
