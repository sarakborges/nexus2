const assert = require('node:assert/strict')
const { test } = require('node:test')
const { UploadsContentService } = require('../dist/api/uploads/uploads.content.service.js')

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

function createService(record, response) {
  const data = {
    async getEditorImageRecord() {
      return record
    },
    async getCommunityAvatarRecord() {
      return record
    }
  }
  const storage = {
    assertConfigured() {},
    async request() {
      return response
    }
  }
  return new UploadsContentService(data, storage)
}

function editorImage(overrides = {}) {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    ownerUserId: 'account-1',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/account-1/image.png',
    contentType: 'image/png',
    size: png.length,
    ...overrides
  }
}

test('managed image content is returned when the stream exactly matches the recorded size', async () => {
  const service = createService(
    editorImage(),
    new Response(png, { status: 200 })
  )

  const result = await service.getEditorImage('account-1', 'image-1')

  assert.deepEqual(result.body, png)
  assert.equal(result.contentType, 'image/png')
})

test('managed image download cancels the stream as soon as it exceeds the recorded size', async () => {
  let cancelled = false
  let pulls = 0
  const stream = new ReadableStream({
    pull(controller) {
      pulls += 1
      controller.enqueue(Buffer.concat([png, Buffer.alloc(2)]))
    },
    cancel() {
      cancelled = true
    }
  }, { highWaterMark: 0 })
  const service = createService(
    editorImage(),
    new Response(stream, { status: 200 })
  )

  await assert.rejects(
    service.getEditorImage('account-1', 'image-1'),
    error => error.getStatus() === 404 && error.message === 'UPLOAD_NOT_FOUND'
  )
  assert.equal(cancelled, true)
  assert.equal(pulls, 1)
})

test('managed image metadata cannot request downloads above the purpose limit', async () => {
  let requested = false
  const response = new Response(png, { status: 200 })
  const service = createService(
    editorImage({ size: 10 * 1024 * 1024 + 1 }),
    response
  )
  service.storage.request = async () => {
    requested = true
    return response
  }

  // The metadata is checked after Storage responds, and the response body is cancelled
  // without reading it when the recorded size exceeds the purpose's maximum.
  await assert.rejects(
    service.getEditorImage('account-1', 'image-1'),
    error => error.getStatus() === 404 && error.message === 'UPLOAD_NOT_FOUND'
  )
  assert.equal(requested, true)
  assert.equal(response.bodyUsed, true)
})
