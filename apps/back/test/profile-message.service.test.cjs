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
