const test = require('node:test')
const assert = require('node:assert/strict')
const { UploadsService } = require('../dist/api/uploads/uploads.service.js')

const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const supabaseUrl = 'https://project.example.supabase.co'
const storageSecret = 'sb_secret_test'
const cronSecret = 'cron-secret-test'

function createHarness(initial = {}, activeProfileId = null, beforeTransaction) {
  const defaultAccounts = [
    { id: 'sender-user', email: 'sender@example.test', profiles: ['sender-profile'], currentProfile: 'sender-profile' },
    { id: 'recipient-user', email: 'recipient@example.test', profiles: ['recipient-profile'], currentProfile: 'recipient-profile' },
    { id: 'community-member-user', email: 'member@example.test', profiles: ['community-member-profile'], currentProfile: 'community-member-profile' },
    { id: 'outsider-user', email: 'outsider@example.test', profiles: [], currentProfile: null },
    { id: 'unrelated-user', email: 'unrelated@example.test', profiles: [], currentProfile: null },
    { id: 'author-user', email: 'author@example.test', profiles: [], currentProfile: null },
    { id: 'user-1', email: 'user@example.test', profiles: activeProfileId ? [activeProfileId] : [], currentProfile: activeProfileId }
  ]
  const collections = new Map(Object.entries({
    accounts: defaultAccounts,
    ...initial
  }))
  const data = {
    async read(name) { return structuredClone(collections.get(name) ?? []) },
    async update(name, updater) {
      const next = updater(structuredClone(collections.get(name) ?? []))
      collections.set(name, structuredClone(next))
      return structuredClone(next)
    },
    async transaction(names, updater) {
      beforeTransaction?.(names, collections)
      const records = Object.fromEntries(names.map(name => [
        name,
        structuredClone(collections.get(name) ?? [])
      ]))
      const outcome = updater(records)
      for (const name of names) {
        if (!Array.isArray(outcome.records[name])) throw new Error('INVALID_TRANSACTION_RECORDS')
      }
      for (const name of names) collections.set(name, structuredClone(outcome.records[name]))
      return structuredClone(outcome.result)
    }
  }
  const auth = {
    async ownsProfile(_userId, profileId) { return profileId === 'profile-1' || profileId === activeProfileId },
    async getUser(id) {
      const profiles = id === 'sender-user'
        ? ['sender-profile']
        : id === 'recipient-user'
          ? ['recipient-profile']
          : id === 'community-member-user'
            ? ['community-member-profile']
            : activeProfileId
              ? [activeProfileId]
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

test('private community images are readable only by members', async t => {
  const file = {
    id: '323e4567-e89b-42d3-a456-426614174000',
    ownerUserId: 'author-user',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/author-user/community.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: pngHeader.length,
    status: 'ready',
    createdAt: Date.now(),
    completedAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    resourceType: 'community',
    resourceId: 'private-community',
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const { service } = createHarness({
    media_files: [file],
    communities: [{ id: 'private-community', privacy: 'private' }],
    community_relationships: [
      { profiles: ['community-member-profile', 'private-community'], type: 'connection' }
    ]
  })
  withFetch(t, async () => new Response(pngHeader, { status: 200 }))

  await assert.rejects(
    service.getEditorImage(null, file.id),
    error => error.getStatus() === 404
  )
  await assert.rejects(
    service.getEditorImage('outsider-user', file.id),
    error => error.getStatus() === 404
  )
  const memberImage = await service.getEditorImage('community-member-user', file.id)
  assert.deepEqual(memberImage.body, pngHeader)
})

test('forum topic images inherit their community privacy rules', async t => {
  const file = {
    id: '423e4567-e89b-42d3-a456-426614174000',
    ownerUserId: 'author-user',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/author-user/topic.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: pngHeader.length,
    status: 'ready',
    createdAt: Date.now(),
    completedAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    resourceType: 'community-forum-topic',
    resourceId: 'topic-1',
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const { service } = createHarness({
    media_files: [file],
    communities: [{ id: 'private-community', privacy: 'private' }],
    community_relationships: [
      { profiles: ['community-member-profile', 'private-community'], type: 'connection' }
    ],
    community_forum_topics: [{ id: 'topic-1', communityId: 'private-community' }]
  })
  withFetch(t, async () => new Response(pngHeader, { status: 200 }))

  await assert.rejects(
    service.getEditorImage('outsider-user', file.id),
    error => error.getStatus() === 404
  )
  const memberImage = await service.getEditorImage('community-member-user', file.id)
  assert.deepEqual(memberImage.body, pngHeader)
})

test('forum reply images are public when their community is public', async t => {
  const file = {
    id: '523e4567-e89b-42d3-a456-426614174000',
    ownerUserId: 'author-user',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/author-user/reply.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: pngHeader.length,
    status: 'ready',
    createdAt: Date.now(),
    completedAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    resourceType: 'community-forum-reply',
    resourceId: 'reply-1',
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const { service } = createHarness({
    media_files: [file],
    communities: [{ id: 'public-community', privacy: 'public' }],
    community_forum_replies: [{ id: 'reply-1', communityId: 'public-community' }]
  })
  withFetch(t, async () => new Response(pngHeader, { status: 200 }))

  const image = await service.getEditorImage(null, file.id)
  assert.deepEqual(image.body, pngHeader)
})

test('deleteUpload does not repeat Storage deletion when another request already claimed the record', async t => {
  const file = {
    id: 'a23e4567-e89b-42d3-a456-426614174000',
    ownerUserId: 'user-1',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/user-1/deleting.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: pngHeader.length,
    status: 'ready',
    createdAt: Date.now(),
    completedAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    resourceType: null,
    resourceId: null,
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const claimed = { ...file, status: 'deleting', deletingAt: Date.now() }
  const { service, collections } = createHarness(
    { media_files: [file] },
    null,
    (names, current) => {
      if (names.includes('media_files')) current.set('media_files', [claimed])
    }
  )
  withFetch(t, async () => {
    throw new Error('A deletion already claimed by another request must not hit Storage again')
  })

  await service.deleteUpload('user-1', file.id)

  assert.deepEqual(collections.get('media_files'), [claimed])
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
    assert.ok(collections.get('media_files').every(item => item.status === 'deleting'))
    deleted.push({ url: String(url), body: JSON.parse(init.body) })
    return new Response(null, { status: 200 })
  })

  await assert.rejects(service.cleanupExpired('wrong'), error => error.getStatus() === 403)
  const results = await Promise.all([
    service.cleanupExpired(cronSecret),
    service.cleanupExpired(cronSecret)
  ])

  assert.deepEqual(results.map(result => result.deleted).sort(), [0, 2])
  assert.equal(deleted.length, 2)
  assert.deepEqual(deleted.find(item => item.url.endsWith('/nexus-avatars')).body.prefixes, ['profiles/user-1/draft.png'])
  assert.deepEqual(deleted.find(item => item.url.endsWith('/nexus-editor-images')).body.prefixes, ['editor/user-1/old.png'])
  assert.deepEqual(collections.get('media_files'), [])
})

test('community avatar uploads reject staff profiles with a different type', async () => {
  const { service } = createHarness({
    community_relationships: [
      { profiles: ['owner-profile', 'community-1'], type: 'owner' },
      { profiles: ['profile-1', 'community-1'], type: 'moderator' }
    ],
    profiles: [{ id: 'owner-profile', type: 'social' }, { id: 'profile-1', type: 'rp' }],
    communities: [{ id: 'community-1', type: 'social' }]
  })

  await assert.rejects(
    service.createUpload('user-1', {
      purpose: 'community-avatar',
      targetId: 'community-1',
      actorProfileId: 'profile-1',
      contentType: 'image/png',
      size: pngHeader.length
    }),
    error => error.getStatus() === 403 && error.message === 'PROFILE_TYPE_MISMATCH'
  )
})

test('avatar draft retention starts when the upload is completed', async () => {
  const now = Date.now()
  const file = {
    id: '823e4567-e89b-42d3-a456-426614174000',
    ownerUserId: 'user-1',
    purpose: 'profile-avatar',
    bucket: 'nexus-avatars',
    path: 'profiles/user-1/recently-completed.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: pngHeader.length,
    status: 'ready',
    createdAt: now - 30 * 60 * 60 * 1000,
    completedAt: now - 23 * 60 * 60 * 1000,
    expiresAt: null,
    resourceType: null,
    resourceId: null,
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const { service, collections } = createHarness({
    accounts: [{ id: 'user-1', email: 'user@example.test', profiles: ['profile-1'], currentProfile: 'profile-1' }],
    profiles: [{ id: 'profile-1', picture: '', type: 'social' }],
    media_files: [file]
  })

  const url = supabaseUrl + '/storage/v1/object/public/nexus-avatars/' + file.path
  await service.validateAvatarUrl('user-1', url, 'profile-avatar')
  const result = await service.setProfileAvatar('user-1', 'profile-1', file.id)

  assert.equal(result.picture, url)
  assert.equal(collections.get('media_files')[0].resourceType, 'profile')
  assert.equal(collections.get('media_files')[0].resourceId, 'profile-1')
})

test('avatar draft validation rejects uploads after 24 hours from completion', async () => {
  const now = Date.now()
  const file = {
    id: '923e4567-e89b-42d3-a456-426614174000',
    ownerUserId: 'user-1',
    purpose: 'profile-avatar',
    bucket: 'nexus-avatars',
    path: 'profiles/user-1/expired-draft.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: pngHeader.length,
    status: 'ready',
    createdAt: now - 48 * 60 * 60 * 1000,
    completedAt: now - 24 * 60 * 60 * 1000 - 1,
    expiresAt: null,
    resourceType: null,
    resourceId: null,
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const { service } = createHarness({
    accounts: [{ id: 'user-1', email: 'user@example.test', profiles: ['profile-1'], currentProfile: 'profile-1' }],
    profiles: [{ id: 'profile-1', picture: '', type: 'social' }],
    media_files: [file]
  })
  const url = supabaseUrl + '/storage/v1/object/public/nexus-avatars/' + file.path

  await assert.rejects(
    service.validateAvatarUrl('user-1', url, 'profile-avatar'),
    error => error.getStatus() === 400 && error.message === 'INVALID_AVATAR_UPLOAD'
  )
  await assert.rejects(
    service.setProfileAvatar('user-1', 'profile-1', file.id),
    error => error.getStatus() === 400 && error.message === 'INVALID_AVATAR_UPLOAD'
  )
})

test('profile avatar upload cannot target a profile of another type than the active profile', async () => {
  const { service } = createHarness({
    profiles: [
      { id: 'profile-1', type: 'rp' },
      { id: 'profile-2', type: 'social' }
    ]
  }, 'profile-2')
  await assert.rejects(
    service.createUpload('user-1', {
      purpose: 'profile-avatar',
      targetId: 'profile-1',
      contentType: 'image/png',
      size: pngHeader.length
    }),
    error => error.getStatus() === 403 && error.message === 'PROFILE_TYPE_MISMATCH'
  )
})


test('attaches and detaches editor image records as pure transaction transformations', () => {
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
    createdAt: Date.now(),
    completedAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    resourceType: null,
    resourceId: null,
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const { service } = createHarness()
  const html = '<p>Message</p><img src="/api/uploads/' + file.id + '/content">'
  const attached = service.attachEditorImagesToRecords(
    [file], 'user-1', html, 'profile-message', 'message-1',
    { fromProfileId: 'sender', toProfileId: 'recipient' }
  )

  assert.equal(attached[0].resourceType, 'profile-message')
  assert.equal(attached[0].resourceId, 'message-1')
  assert.equal(attached[0].messageFromProfileId, 'sender')
  assert.equal(attached[0].messageToProfileId, 'recipient')
  assert.throws(
    () => service.attachEditorImagesToRecords(attached, 'user-1', html, 'profile-message', 'message-2'),
    error => error.getStatus() === 400 && error.message === 'EDITOR_IMAGE_ALREADY_ATTACHED'
  )

  const detached = service.detachResourceAttachmentsFromRecords(attached, null, [
    { resourceType: 'profile-message', resourceId: 'message-1' }
  ])
  assert.equal(detached[0].resourceType, null)
  assert.equal(detached[0].resourceId, null)
  assert.equal(detached[0].messageFromProfileId, null)
  assert.equal(detached[0].messageToProfileId, null)
})

test('updates a profile avatar and attaches its metadata in one transaction', async () => {
  const file = {
    id: '223e4567-e89b-42d3-a456-426614174000',
    ownerUserId: 'user-1',
    purpose: 'profile-avatar',
    bucket: 'nexus-avatars',
    path: 'profiles/user-1/avatar.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: pngHeader.length,
    status: 'ready',
    createdAt: Date.now(),
    completedAt: Date.now(),
    expiresAt: null,
    resourceType: null,
    resourceId: null,
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const { service, collections } = createHarness({
    accounts: [{ id: 'user-1', email: 'user@example.test', profiles: ['profile-1'], currentProfile: 'profile-1' }],
    profiles: [{ id: 'profile-1', picture: '', type: 'social' }],
    media_files: [file]
  })

  const result = await service.setProfileAvatar('user-1', 'profile-1', file.id)
  assert.equal(result.picture, 'https://project.example.supabase.co/storage/v1/object/public/nexus-avatars/profiles/user-1/avatar.png')
  assert.equal(collections.get('profiles')[0].picture, result.picture)
  assert.equal(collections.get('media_files')[0].resourceType, 'profile')
  assert.equal(collections.get('media_files')[0].resourceId, 'profile-1')
})

test('rejects invalid avatar metadata without changing the profile or media collection', async () => {
  const file = {
    id: '323e4567-e89b-42d3-a456-426614174000',
    ownerUserId: 'another-user',
    purpose: 'profile-avatar',
    bucket: 'nexus-avatars',
    path: 'profiles/another-user/avatar.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: pngHeader.length,
    status: 'ready',
    createdAt: Date.now(),
    completedAt: Date.now(),
    expiresAt: null,
    resourceType: null,
    resourceId: null,
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const { service, collections } = createHarness({
    accounts: [{ id: 'user-1', email: 'user@example.test', profiles: ['profile-1'], currentProfile: 'profile-1' }],
    profiles: [{ id: 'profile-1', picture: '', type: 'social' }],
    media_files: [file]
  })

  await assert.rejects(
    service.setProfileAvatar('user-1', 'profile-1', file.id),
    error => error.getStatus() === 400 && error.message === 'INVALID_AVATAR_UPLOAD'
  )
  assert.equal(collections.get('profiles')[0].picture, '')
  assert.deepEqual(collections.get('media_files'), [file])
})


test('profile avatar write rechecks account ownership in the profile/media transaction', async () => {
  const original = { id: 'profile-1', picture: 'old-picture', type: 'social' }
  const { service, collections } = createHarness({
    accounts: [{ id: 'user-1', email: 'user@example.test', profiles: ['profile-1'], currentProfile: 'profile-1' }],
    profiles: [original],
    media_files: []
  }, 'profile-1', (names, current) => {
    if (names.includes('profiles')) current.set('accounts', [])
  })

  await assert.rejects(
    service.setProfileAvatar('user-1', 'profile-1', null),
    error => error.getStatus() === 403 && error.message === 'PROFILE_NOT_OWNED'
  )
  assert.deepEqual(collections.get('profiles'), [original])
})

test('community avatar write rechecks staff role in the community/media transaction', async () => {
  const original = { id: 'community-1', picture: 'old-picture', type: 'social' }
  const { service, collections } = createHarness({
    accounts: [{
      id: 'user-1', email: 'user@example.test',
      profiles: ['moderator-profile'], currentProfile: 'moderator-profile'
    }],
    profiles: [
      { id: 'owner-profile', type: 'social' },
      { id: 'moderator-profile', type: 'social' }
    ],
    communities: [original],
    community_relationships: [
      { profiles: ['owner-profile', 'community-1'], type: 'owner' },
      { profiles: ['moderator-profile', 'community-1'], type: 'moderator' }
    ],
    media_files: []
  }, 'moderator-profile', (names, current) => {
    if (names.includes('communities')) {
      current.set('community_relationships', [
        { profiles: ['owner-profile', 'community-1'], type: 'owner' },
        { profiles: ['moderator-profile', 'community-1'], type: 'connection' }
      ])
    }
  })

  await assert.rejects(
    service.setCommunityAvatar('user-1', 'community-1', 'moderator-profile', null),
    error => error.getStatus() === 403 && error.message === 'COMMUNITY_STAFF_REQUIRED'
  )
  assert.deepEqual(collections.get('communities'), [original])
})


test('private community image access rechecks membership from the storage-read snapshot', async t => {
  const file = {
    id: '623e4567-e89b-42d3-a456-426614174000',
    ownerUserId: 'author-user',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/author-user/private.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: pngHeader.length,
    status: 'ready',
    createdAt: Date.now(),
    completedAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    resourceType: 'community',
    resourceId: 'private-community',
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const { service } = createHarness({
    media_files: [file],
    communities: [{ id: 'private-community', privacy: 'private' }],
    community_relationships: [
      { profiles: ['community-member-profile', 'private-community'], type: 'connection' }
    ]
  }, null, (names, current) => {
    if (names.includes('communities')) {
      current.set('community_relationships', [])
    }
  })
  withFetch(t, async () => {
    throw new Error('Unauthorized storage objects must not be fetched')
  })

  await assert.rejects(
    service.getEditorImage('community-member-user', file.id),
    error => error.getStatus() === 404 && error.message === 'UPLOAD_NOT_FOUND'
  )
})

test('private message image access rechecks participant profile links from the message snapshot', async t => {
  const file = {
    id: '723e4567-e89b-42d3-a456-426614174000',
    ownerUserId: 'sender-user',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/sender-user/private-message.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: pngHeader.length,
    status: 'ready',
    createdAt: Date.now(),
    completedAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    resourceType: 'profile-message',
    resourceId: 'message-2',
    messageFromProfileId: 'sender-profile',
    messageToProfileId: 'recipient-profile'
  }
  const message = { id: 'message-2', fromProfileId: 'sender-profile', toProfileId: 'recipient-profile' }
  const { service } = createHarness({
    media_files: [file],
    profile_messages: [message]
  }, null, (names, current) => {
    if (names.includes('profile_messages')) {
      current.set('accounts', [
        { id: 'sender-user', email: 'sender@example.test', profiles: [], currentProfile: null },
        { id: 'recipient-user', email: 'recipient@example.test', profiles: ['recipient-profile'], currentProfile: 'recipient-profile' }
      ])
    }
  })
  withFetch(t, async () => {
    throw new Error('Unauthorized storage objects must not be fetched')
  })

  await assert.rejects(
    service.getEditorImage('sender-user', file.id),
    error => error.getStatus() === 403 && error.message === 'UPLOAD_ACCESS_DENIED'
  )
})
