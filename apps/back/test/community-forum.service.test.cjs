const test = require('node:test')
const assert = require('node:assert/strict')
const { ConflictException, BadRequestException } = require('@nestjs/common')
const { CommunityForumService } = require('../dist/api/domain/community-forum.service.js')

function createService() {
  const calls = []
  const notifications = []
  const repository = {
    async createCommunityForumTopic(change) {
      calls.push(['topic', change])
      return change.topic
    },
    async createCommunityForumReply(change) {
      calls.push(['reply', change])
      return change.reply
    },
    async moderateCommunityForumTopic(change) {
      calls.push(['moderate', change])
      return {
        id: change.topicId,
        communityId: change.communityId,
        profileId: change.actorProfileId,
        title: 'Topic',
        content: '<p>Hello</p>',
        createdAt: 1,
        updatedAt: change.updatedAt,
        isPinned: Boolean(change.isPinned),
        isLocked: Boolean(change.isLocked)
      }
    },
    async deleteCommunityForumTopic(change) {
      calls.push(['delete-topic', change])
    },
    async deleteCommunityForumReply(change) {
      calls.push(['delete-reply', change])
      return 'topic-1'
    },
    async transaction() {
      throw new Error('Direct forum operations must not use collection snapshots.')
    }
  }
  const uploads = { getEditorImageIds() { return ['image-1'] } }
  const realtime = { async publishTopicChanged(id) { notifications.push(id) } }
  return {
    service: new CommunityForumService(repository, {}, uploads, realtime),
    calls,
    notifications
  }
}

test('forum mutations use direct relational operations and keep realtime notifications', async () => {
  const { service, calls, notifications } = createService()

  const topic = await service.createCommunityForumTopic(
    'account-1', 'community-1', 'profile-1', '  A   topic  ', '<p>Hello</p>'
  )
  const reply = await service.createCommunityForumReply(
    'account-1', 'community-1', 'topic-1', 'profile-1', '<p>Reply</p>'
  )
  const moderated = await service.moderateCommunityForumTopic(
    'account-1', 'community-1', 'topic-1', 'profile-1', { isPinned: true }
  )
  await service.deleteCommunityForumTopic('account-1', 'community-1', 'topic-1', 'profile-1')
  await service.deleteCommunityForumReply('account-1', 'community-1', 'reply-1', 'profile-1')

  assert.equal(topic.title, 'A topic')
  assert.equal(reply.topicId, 'topic-1')
  assert.equal(moderated.isPinned, true)
  assert.deepEqual(calls.map(call => call[0]), [
    'topic', 'reply', 'moderate', 'delete-topic', 'delete-reply'
  ])
  assert.deepEqual(calls[0][1].imageIds, ['image-1'])
  assert.deepEqual(calls[1][1].imageIds, ['image-1'])
  assert.deepEqual(notifications, ['topic-1', 'topic-1', 'topic-1', 'topic-1', 'topic-1'])
})

test('invalid topics are rejected before a relational write', async () => {
  const { service, calls } = createService()
  await assert.rejects(
    service.createCommunityForumTopic('account-1', 'community-1', 'profile-1', '   ', '<p>Hello</p>'),
    error => error instanceof BadRequestException && error.message === 'INVALID_FORUM_TOPIC'
  )
  assert.equal(calls.length, 0)
})

test('empty replies are rejected before a relational write', async () => {
  const { service, calls } = createService()
  await assert.rejects(
    service.createCommunityForumReply('account-1', 'community-1', 'topic-1', 'profile-1', '<p><br></p>'),
    error => error instanceof BadRequestException && error.message === 'INVALID_FORUM_REPLY'
  )
  assert.equal(calls.length, 0)
})
