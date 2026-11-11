const test = require('node:test')
const assert = require('node:assert/strict')

const { detachEditorImages } = require('../dist/api/uploads/uploads.attachments.js')
const { getRemovedEditorImages } = require('../dist/api/domain/domain.utils.js')

const imageA = '123e4567-e89b-42d3-a456-426614174000'
const imageB = '223e4567-e89b-42d3-a456-426614174000'
const imageC = '323e4567-e89b-42d3-a456-426614174000'

function imageUrl(id) {
  return '/api/uploads/' + id + '/content'
}

function editorRecord(id, resourceType, resourceId) {
  return {
    id,
    ownerUserId: 'user-1',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/user-1/' + id + '.png',
    contentType: 'image/png',
    expectedSize: 8,
    size: 8,
    status: 'ready',
    createdAt: 1,
    completedAt: 1,
    expiresAt: null,
    resourceType,
    resourceId,
    messageFromProfileId: null,
    messageToProfileId: null
  }
}

test('removed editor images are detached only from the resource being edited', () => {
  const previousHtml =
    '<p>before</p><img src="' + imageUrl(imageA) + '"><img src="' + imageUrl(imageB) + '">'
  const currentHtml = '<p>after</p><img src="' + imageUrl(imageA) + '">'
  const removedHtml = getRemovedEditorImages(previousHtml, currentHtml)

  assert.equal(removedHtml, '<img src="' + imageUrl(imageB) + '">')

  const records = [
    editorRecord(imageA, 'community', 'community-1'),
    editorRecord(imageB, 'community', 'community-1'),
    editorRecord(imageC, 'profile', 'profile-1')
  ]
  const updated = detachEditorImages(
    records,
    removedHtml,
    'community',
    'community-1'
  )

  assert.deepEqual(
    updated.map(item => [item.id, item.resourceType, item.resourceId]),
    [
      [imageA, 'community', 'community-1'],
      [imageB, null, null],
      [imageC, 'profile', 'profile-1']
    ]
  )
})

test('detaching an image does not release avatar records or other resource types', () => {
  const records = [
    {
      ...editorRecord(imageA, 'community', 'community-1'),
      purpose: 'community-avatar'
    },
    editorRecord(imageB, 'community-forum-topic', 'topic-1')
  ]
  const updated = detachEditorImages(
    records,
    '<img src="' + imageUrl(imageA) + '"><img src="' + imageUrl(imageB) + '">',
    'community',
    'community-1'
  )

  assert.equal(updated[0].resourceType, 'community')
  assert.equal(updated[1].resourceType, 'community-forum-topic')
})
