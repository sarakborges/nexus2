const test = require('node:test')
const assert = require('node:assert/strict')
const { UploadsService } = require('../dist/api/uploads/uploads.service.js')

const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const supabaseUrl = 'https://project.example.supabase.co'
const storageSecret = 'sb_secret_test'
const cronSecret = 'cron-secret-test'

function createHarness(initial = {}) {
  const collections = new Map(Object.entries(initial))
  const data = {
    async read(name) { return structuredClone(collections.get(name) ?? []) },
    async write(name, records) { collections.set(name, structuredClone(records)) }
  }
  const auth = {
    async ownsProfile(_userId, profileId) { return profileId === 'profile-1' },
    async getUser(id) {
      const profiles = id === 'sender-user'
        ? ['sender-profile']
        : id === 'recipient-user'
          ? ['recipient-profile']
          : []
      return {
        id,
        email: 'user@example.test',
        profiles,
        currentProfile: profiles[0] ?? null
      }
    }
  }
  const config = {
    get(name) {
      return {
        SUPABASE_URL: supabaseUrl,
        SUPABASE_STORAGE_SECRET_KEY: storageSecret,
        CRON_SECRET: cronSecret
      }[name]
    }
  }
  return {
    service: new UploadsService(data, auth, config),
    collections
  }
}

function withFetch(t, handler) {
  const original = global.fetch
  global.fetch = handler
  t.after(() => { global.fetch = original })
}

test('creates an owner-scoped signed upload and stores a pending metadata record', async t => {
  const { service, collections } = createHarness()
  let requestedUrl = ''
  withFetch(t, async (url, init) => {
    requestedUrl = String(url)
    assert.equal(init.method, 'POST')
    assert.equal(new Headers(init.headers).get('authorization'), null)
    assert.equal(new Headers(init.headers).get('apikey'), storageSecret)
    return new Response(JSON.stringify({
      url: '/object/upload/sign/nexus-editor-images/editor/user-1/file.png?token=signed-token'
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  })

  const result = await service.createUpload('user-1', {
    purpose: 'editor-image',
    contentType: 'image/png',
    size: 1024
  })

  assert.match(requestedUrl, /\/object\/upload\/sign\/nexus-editor-images\//)
  assert.match(result.uploadUrl, /token=signed-token/)
  const records = collections.get('media_files')
  assert.equal(records.length, 1)
  assert.equal(records[0].ownerUserId, 'user-1')
  assert.equal(records[0].status, 'pending')
  assert.equal(records[0].expiresAt, null)
})

test('completion validates the stored bytes and sets editor expiration to 24 hours', async t => {
  const file = {
    id: '123e4567-e89b-42d3-a456-426614174000',
    ownerUserId: 'user-1',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/user-1/image.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: null,
    status: 'pending',
    createdAt: Date.now(),
    completedAt: null,
    expiresAt: null,
    resourceType: null,
    resourceId: null,
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const { service, collections } = createHarness({ media_files: [file] })
  withFetch(t, async (_url, init) => {
    assert.equal(init.method, 'GET')
    assert.equal(new Headers(init.headers).get('range'), 'bytes=0-63')
    return new Response(pngHeader, {
      status: 206,
      headers: {
        'content-range': 'bytes 0-7/8',
        'content-length': '8'
      }
    })
  })

  const result = await service.completeUpload('user-1', file.id)
  const saved = collections.get('media_files')[0]
  assert.equal(result.url, '/api/uploads/' + file.id + '/content')
  assert.equal(saved.status, 'ready')
  assert.equal(saved.expiresAt - saved.completedAt, 24 * 60 * 60 * 1000)
})

test('denies editor image access after the 24-hour deadline', async t => {
  const file = {
    id: '123e4567-e89b-42d3-a456-426614174000',
    ownerUserId: 'user-1',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/user-1/image.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: pngHeader.length,
    status: 'ready',
    createdAt: Date.now() - 48 * 60 * 60 * 1000,
    completedAt: Date.now() - 48 * 60 * 60 * 1000,
    expiresAt: Date.now() - 1,
    resourceType: 'profile',
    resourceId: 'profile-1',
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const { service } = createHarness({ media_files: [file], profiles: [{ id: 'profile-1' }] })
  withFetch(t, async () => {
    throw new Error('Expired objects must not reach Storage')
  })

  await assert.rejects(
    service.getEditorImage(null, file.id),
    error => error.getStatus() === 404
  )
})

test('only message participants can read private message images', async t => {
  const file = {
    id: '123e4567-e89b-42d3-a456-426614174000',
    ownerUserId: 'sender-user',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/sender-user/image.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: pngHeader.length,
    status: 'ready',
    createdAt: Date.now(),
    completedAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    resourceType: 'profile-message',
    resourceId: 'message-1',
    messageFromProfileId: 'sender-profile',
    messageToProfileId: 'recipient-profile'
  }
  const message = { id: 'message-1', fromProfileId: 'sender-profile', toProfileId: 'recipient-profile' }
  const { service } = createHarness({
    media_files: [file],
    profile_messages: [message]
  })
  withFetch(t, async (_url, init) => {
    assert.equal(new Headers(init.headers).get('authorization'), null)
    return new Response(pngHeader, { status: 200 })
  })

  await assert.rejects(
    service.getEditorImage('unrelated-user', file.id),
    error => error.getStatus() === 403
  )
  const senderImage = await service.getEditorImage('sender-user', file.id)
  assert.equal(senderImage.contentType, 'image/png')
  assert.deepEqual(senderImage.body, pngHeader)
  const recipientImage = await service.getEditorImage('recipient-user', file.id)
  assert.deepEqual(recipientImage.body, pngHeader)
})

test('daily cleanup removes expired editor objects and unattached avatar drafts', async t => {
  const now = Date.now()
  const editor = {
    id: '123e4567-e89b-42d3-a456-426614174000',
    ownerUserId: 'user-1',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/user-1/old.png',
    contentType: 'image/png',
    expectedSize: 8,
    size: 8,
    status: 'ready',
    createdAt: now - 48 * 60 * 60 * 1000,
    completedAt: now - 48 * 60 * 60 * 1000,
    expiresAt: now - 24 * 60 * 60 * 1000,
    resourceType: 'profile',
    resourceId: 'profile-1',
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const avatar = {
    id: '223e4567-e89b-42d3-a456-426614174000',
    ownerUserId: 'user-1',
    purpose: 'profile-avatar',
    bucket: 'nexus-avatars',
    path: 'profiles/user-1/draft.png',
    contentType: 'image/png',
    expectedSize: 8,
    size: 8,
    status: 'ready',
    createdAt: now - 48 * 60 * 60 * 1000,
    completedAt: now - 48 * 60 * 60 * 1000,
    expiresAt: null,
    resourceType: null,
    resourceId: null,
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const { service, collections } = createHarness({ media_files: [editor, avatar] })
  const deleted = []
  withFetch(t, async (url, init) => {
    assert.equal(init.method, 'DELETE')
    deleted.push({ url: String(url), body: JSON.parse(init.body) })
    return new Response(null, { status: 200 })
  })

  await assert.rejects(service.cleanupExpired('wrong'), error => error.getStatus() === 403)
  const result = await service.cleanupExpired(cronSecret)

  assert.equal(result.deleted, 2)
  assert.equal(deleted.length, 2)
  assert.deepEqual(deleted.find(item => item.url.endsWith('/nexus-avatars')).body.prefixes, ['profiles/user-1/draft.png'])
  assert.deepEqual(deleted.find(item => item.url.endsWith('/nexus-editor-images')).body.prefixes, ['editor/user-1/old.png'])
  assert.deepEqual(collections.get('media_files'), [])
})
test('editing a resource may retain old editor-image references after their metadata has expired', async () => {
  const retainedId = '123e4567-e89b-42d3-a456-426614174000'
  const newId = '223e4567-e89b-42d3-a456-426614174000'
  const oldFile = {
    id: retainedId,
    ownerUserId: 'previous-owner',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/previous-owner/old.png',
    contentType: 'image/png',
    expectedSize: 8,
    size: 8,
    status: 'ready',
    createdAt: Date.now() - 48 * 60 * 60 * 1000,
    completedAt: Date.now() - 48 * 60 * 60 * 1000,
    expiresAt: Date.now() - 24 * 60 * 60 * 1000,
    resourceType: 'profile',
    resourceId: 'profile-1',
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const newFile = {
    id: newId,
    ownerUserId: 'current-owner',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/current-owner/new.png',
    contentType: 'image/png',
    expectedSize: 8,
    size: 8,
    status: 'ready',
    createdAt: Date.now(),
    completedAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    resourceType: null,
    resourceId: null,
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const { service, collections } = createHarness({ media_files: [oldFile, newFile] })
  const html = '<p>Updated</p>' +
    '<img src="/api/uploads/' + retainedId + '/content">' +
    '<img src="/api/uploads/' + newId + '/content">'

  await service.validateEditorImagesForResource(
    'current-owner', html, 'profile', 'profile-1', [retainedId]
  )
  await service.attachEditorImagesForResource(
    'current-owner', html, 'profile', 'profile-1', [retainedId]
  )

  const records = collections.get('media_files')
  assert.equal(records.find(item => item.id === retainedId).resourceId, 'profile-1')
  assert.equal(records.find(item => item.id === newId).resourceType, 'profile')
  assert.equal(records.find(item => item.id === newId).resourceId, 'profile-1')
})
