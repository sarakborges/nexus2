const test = require('node:test')
const assert = require('node:assert/strict')
const { ForbiddenException, NotFoundException, UnauthorizedException } = require('@nestjs/common')
const { UploadsService } = require('../dist/api/uploads/uploads.service.js')
const { UploadsStorageService } = require('../dist/api/uploads/uploads.storage.service.js')
const { UploadsCleanupService } = require('../dist/api/uploads/uploads.cleanup.service.js')
const { UploadsContentService } = require('../dist/api/uploads/uploads.content.service.js')
const { UploadsAvatarService } = require('../dist/api/uploads/uploads.avatar.service.js')

const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const supabaseUrl = 'https://project.example.supabase.co'
const storageSecret = 'sb_secret_test'
const cronSecret = 'cron-secret-test'


async function resolveEditorImageRecord(data, { userId, id, now }) {
  const initialRecords = await data.read('media_files')
  const locator = initialRecords.find(item =>
    item.id === id &&
    item.purpose === 'editor-image' &&
    (item.status === 'ready' || (
      item.status === 'deleting' && item.resourceType && item.resourceId
    ))
  )
  if (!locator || (
    !locator.resourceType && !locator.resourceId &&
    locator.expiresAt !== null && locator.expiresAt <= now
  )) {
    throw new NotFoundException('UPLOAD_NOT_FOUND')
  }

  const resourceType = locator.resourceType
  const resourceId = locator.resourceId
  const collections = ['media_files']
  if (resourceType === 'profile') collections.push('profiles')
  if (resourceType === 'profile-post') collections.push('profile_posts')
  if (
    resourceType === 'community' ||
    resourceType === 'community-forum-topic' ||
    resourceType === 'community-forum-reply'
  ) {
    collections.push('accounts', 'communities', 'community_relationships')
    if (resourceType === 'community-forum-topic') collections.push('community_forum_topics')
    if (resourceType === 'community-forum-reply') collections.push('community_forum_replies')
  }
  if (resourceType === 'profile-message') collections.push('accounts', 'profile_messages')

  return data.transaction(collections, current => {
    const latest = current.media_files.find(item => item.id === id)
    if (
      !latest ||
      latest.purpose !== 'editor-image' ||
      (latest.status !== 'ready' && !(
        latest.status === 'deleting' && latest.resourceType && latest.resourceId
      )) ||
      (!latest.resourceType && !latest.resourceId && latest.expiresAt !== null && latest.expiresAt <= now) ||
      latest.resourceType !== resourceType ||
      latest.resourceId !== resourceId
    ) throw new NotFoundException('UPLOAD_NOT_FOUND')

    if (!latest.resourceType) {
      if (userId !== latest.ownerUserId) throw new ForbiddenException('UPLOAD_ACCESS_DENIED')
      return { records: current, result: latest }
    }

    if (latest.resourceType === 'profile') {
      if (!current.profiles.some(profile => profile.id === latest.resourceId)) {
        throw new NotFoundException('UPLOAD_NOT_FOUND')
      }
      return { records: current, result: latest }
    }

    if (latest.resourceType === 'profile-post') {
      if (!current.profile_posts.some(post => post.id === latest.resourceId)) {
        throw new NotFoundException('UPLOAD_NOT_FOUND')
      }
      return { records: current, result: latest }
    }

    if (
      latest.resourceType === 'community' ||
      latest.resourceType === 'community-forum-topic' ||
      latest.resourceType === 'community-forum-reply'
    ) {
      let communityId = latest.resourceId
      if (
        latest.resourceType === 'community-forum-topic' ||
        latest.resourceType === 'community-forum-reply'
      ) {
        const resourceCollection = latest.resourceType === 'community-forum-topic'
          ? current.community_forum_topics
          : current.community_forum_replies
        const resource = resourceCollection.find(item => item.id === latest.resourceId)
        if (!resource) throw new NotFoundException('UPLOAD_NOT_FOUND')
        communityId = resource.communityId
      }

      const community = current.communities.find(item => item.id === communityId)
      if (!community) throw new NotFoundException('UPLOAD_NOT_FOUND')
      if (community.privacy === 'private') {
        if (!userId) throw new NotFoundException('UPLOAD_NOT_FOUND')
        const account = current.accounts.find(item => item.id === userId)
        if (!account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
        const ownedProfiles = new Set(account.profiles)
        const canRead = current.community_relationships.some(relationship =>
          relationship.profiles[1] === communityId &&
          ownedProfiles.has(relationship.profiles[0]) &&
          ['owner', 'moderator', 'connection'].includes(relationship.type)
        )
        if (!canRead) throw new NotFoundException('UPLOAD_NOT_FOUND')
      }
      return { records: current, result: latest }
    }

    if (latest.resourceType === 'profile-message') {
      if (!userId) throw new ForbiddenException('UPLOAD_ACCESS_DENIED')
      const account = current.accounts.find(item => item.id === userId)
      if (!account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
      const message = current.profile_messages.find(item => item.id === latest.resourceId)
      if (
        !message ||
        message.fromProfileId !== latest.messageFromProfileId ||
        message.toProfileId !== latest.messageToProfileId
      ) throw new NotFoundException('UPLOAD_NOT_FOUND')
      const participants = [message.fromProfileId, message.toProfileId]
      if (!account.profiles.some(profileId => participants.includes(profileId))) {
        throw new ForbiddenException('UPLOAD_ACCESS_DENIED')
      }
      return { records: current, result: latest }
    }

    throw new NotFoundException('UPLOAD_NOT_FOUND')
  })
}

function createHarness(initial = {}, activeProfileId = null, beforeTransaction, beforeUpdate) {
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
  const resourceCollections = collections
  const data = {
    async read(name) { return structuredClone(collections.get(name) ?? []) },
    async update(name, updater) {
      beforeUpdate?.(name, collections)
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
  data.getEditorImageRecord = request => resolveEditorImageRecord(data, request)
  const config = {
    get(name) {
      return {
        SUPABASE_URL: supabaseUrl,
        SUPABASE_STORAGE_SECRET_KEY: storageSecret,
        CRON_SECRET: cronSecret
      }[name]
    }
  }
  const storage = new UploadsStorageService(config)
  const cleanup = new UploadsCleanupService(data, config, storage)
  const content = new UploadsContentService(data, storage)
  const avatars = new UploadsAvatarService(data, storage, cleanup)
  data.createUpload = async change => {
    const { record, targetId, actorProfileId } = change
    const names = ['media_files']
    if (record.purpose === 'profile-avatar' && targetId) names.push('accounts', 'profiles')
    if (record.purpose === 'community-avatar' && targetId) {
      names.push('accounts', 'profiles', 'communities', 'community_relationships')
    }
    await data.transaction(names, collections => {
      const profiles = collections.profiles
      const accounts = collections.accounts
      if (record.purpose === 'profile-avatar' && targetId) {
        avatars.assertOwnsProfileInRecords(record.ownerUserId, targetId, accounts, profiles)
      }
      if (record.purpose === 'community-avatar' && targetId && actorProfileId) {
        avatars.assertOwnsProfileInRecords(record.ownerUserId, actorProfileId, accounts, profiles)
        const actor = profiles.find(item => item.id === actorProfileId)
        const community = collections.communities.find(item => item.id === targetId)
        const ownerProfileId = collections.community_relationships.find(item =>
          item.profiles[1] === targetId && item.type === 'owner'
        )?.profiles[0]
        const owner = ownerProfileId ? profiles.find(item => item.id === ownerProfileId) : undefined
        if (!actor || !community || !owner) throw new NotFoundException('COMMUNITY_NOT_FOUND')
        if (actor.type !== owner.type) throw new ForbiddenException('PROFILE_TYPE_MISMATCH')
        const role = collections.community_relationships.find(item =>
          item.profiles[0] === actorProfileId && item.profiles[1] === targetId
        )?.type
        if (role !== 'owner' && role !== 'moderator') throw new ForbiddenException('COMMUNITY_STAFF_REQUIRED')
      }
      return {
        records: { ...collections, media_files: [...collections.media_files, record] },
        result: undefined
      }
    })
  }
  data.getUploadById = async (userId, id) => {
    const records = await data.read('media_files')
    return records.find(item => item.id === id && item.ownerUserId === userId) ?? null
  }
  data.deletePendingUpload = async (userId, id) => {
    await data.update('media_files', records => records.filter(item =>
      item.id !== id || item.ownerUserId !== userId || item.status !== 'pending'
    ))
  }
  data.completeUpload = async change => {
    const savedRecords = await data.update('media_files', currentRecords => {
      const latest = currentRecords.find(item => item.id === change.id && item.ownerUserId === change.userId)
      if (!latest) throw new NotFoundException('UPLOAD_NOT_FOUND')
      if (latest.status === 'ready') return currentRecords
      if (latest.status !== 'pending' || latest.createdAt + change.pendingMaxAge <= Date.now()) {
        throw new NotFoundException('UPLOAD_EXPIRED')
      }
      const saved = {
        ...latest,
        size: change.size,
        status: 'ready',
        deletingAt: null,
        completedAt: change.completedAt,
        expiresAt: change.expiresAt
      }
      return currentRecords.map(item => item.id === change.id ? saved : item)
    })
    const saved = savedRecords.find(item => item.id === change.id && item.ownerUserId === change.userId)
    if (!saved) throw new NotFoundException('UPLOAD_NOT_FOUND')
    return saved
  }
  data.claimExpiredUploads = async change => data.transaction(
    ['media_files'],
    collections => {
      const currentRecords = collections.media_files
      const resourceTable = {
        profile: 'profiles',
        community: 'communities',
        'profile-message': 'profile_messages',
        'profile-post': 'profile_posts',
        'community-forum-topic': 'community_forum_topics',
        'community-forum-reply': 'community_forum_replies'
      }
      const isOrphanedEditorImage = item => {
        if (item.purpose !== 'editor-image' || !item.resourceType) return false
        if (item.status !== 'ready') {
          const claimExpired = item.status === 'deleting' &&
            (item.deletingAt ?? 0) <= change.now - change.claimLeaseMs &&
            (item.deleteAfter == null || item.deleteAfter <= change.now)
          if (!claimExpired) return false
        }
        const table = resourceTable[item.resourceType]
        return !table || !(resourceCollections.get(table) ?? []).some(row => row.id === item.resourceId)
      }
      const isOrphanedAvatar = item => (
        item.status === 'ready' &&
        (
          (item.purpose === 'profile-avatar' && item.resourceType === 'profile' &&
            !(resourceCollections.get('profiles') ?? []).some(row => row.id === item.resourceId)) ||
          (item.purpose === 'community-avatar' && item.resourceType === 'community' &&
            !(resourceCollections.get('communities') ?? []).some(row => row.id === item.resourceId))
        ) &&
        (item.completedAt ?? item.createdAt) + change.orphanAvatarRetentionMs <= change.now
      )
      const candidates = currentRecords.filter(item =>
        (item.status === 'deleting' &&
          (item.purpose !== 'editor-image' || (!item.resourceType && !item.resourceId)) &&
          (item.deletingAt ?? 0) <= change.now - change.claimLeaseMs &&
          (item.deleteAfter == null || item.deleteAfter <= change.now)) ||
        (item.purpose === 'editor-image' && item.status === 'ready' &&
          !item.resourceType && !item.resourceId &&
          item.expiresAt !== null && item.expiresAt <= change.now) ||
        (item.status === 'pending' && item.createdAt + change.safeAge <= change.now) ||
        (item.purpose !== 'editor-image' && item.status === 'ready' &&
          !item.resourceType &&
          (item.completedAt ?? item.createdAt) + change.orphanAvatarRetentionMs <= change.now) ||
        isOrphanedEditorImage(item) ||
        isOrphanedAvatar(item)
      )
      if (!candidates.length) return { records: collections, result: [] }
      const candidateIds = new Set(candidates.map(item => item.id))
      const claimed = candidates.map(item => ({
        ...item, status: 'deleting', deletingAt: change.now, deleteAfter: null
      }))
      const claimedById = new Map(claimed.map(item => [item.id, item]))
      return {
        records: {
          ...collections,
          media_files: currentRecords.map(item => candidateIds.has(item.id) ? claimedById.get(item.id) : item)
        },
        result: claimed
      }
    }
  )
  data.finishUploadDeletions = async claims => {
    let deleted = 0
    await data.update('media_files', records => {
      const claimedById = new Map(claims.map(item => [item.id, item]))
      const remaining = records.filter(item => {
        const claim = claimedById.get(item.id)
        const resourceTable = {
          profile: 'profiles',
          community: 'communities',
          'profile-message': 'profile_messages',
          'profile-post': 'profile_posts',
          'community-forum-topic': 'community_forum_topics',
          'community-forum-reply': 'community_forum_replies'
        }
        const table = resourceTable[item.resourceType]
        const sourceExists = Boolean(
          item.purpose === 'editor-image' &&
          item.resourceType &&
          table &&
          (resourceCollections.get(table) ?? []).some(row => row.id === item.resourceId)
        )
        const shouldDelete = Boolean(
          claim && item.status === 'deleting' && item.deletingAt === claim.deletingAt &&
          !sourceExists
        )
        if (shouldDelete) deleted += 1
        return !shouldDelete
      })
      return remaining
    })
    return deleted
  }
  data.schedulePreviousAvatarDeletion = async change => data.transaction(
    ['media_files'],
    collections => {
      const current = collections.media_files
      const latest = current.find(item => item.bucket === 'nexus-avatars' && item.path === change.path)
      const hasActiveClaim = Boolean(
        latest?.status === 'deleting' &&
        (latest.deletingAt ?? 0) > change.deletingAt - change.leaseMs
      )
      if (!latest || latest.id === change.keepId || hasActiveClaim) {
        return { records: collections, result: null }
      }
      const safeFrom = latest.completedAt ?? latest.createdAt
      const scheduled = {
        ...latest,
        status: 'deleting',
        deletingAt: change.deletingAt,
        deleteAfter: Math.max(
          safeFrom + change.safeAge,
          change.deletingAt + change.leaseMs
        )
      }
      return {
        records: {
          ...collections,
          media_files: current.map(item => item.id === latest.id ? scheduled : item)
        },
        result: scheduled
      }
    }
  )
  data.scheduleUploadDeletion = async change => data.transaction(
    ['media_files'],
    collections => {
      const current = collections.media_files
      const latest = current.find(item => item.id === change.id)
      if (!latest || latest.ownerUserId !== change.userId) {
        return { records: collections, result: true }
      }
      if (latest.status === 'deleting' && latest.deleteAfter != null) {
        return { records: collections, result: true }
      }
      if (latest.status !== 'pending' && !(change.allowReady && latest.status === 'ready')) {
        return { records: collections, result: false }
      }
      if (latest.resourceType) throw new ForbiddenException('UPLOAD_ALREADY_ATTACHED')
      const safeFrom = latest.status === 'ready'
        ? (latest.completedAt ?? latest.createdAt)
        : latest.createdAt
      const scheduled = {
        ...latest,
        status: 'deleting',
        deletingAt: change.scheduledAt,
        deleteAfter: Math.max(
          safeFrom + change.safeAge,
          change.scheduledAt + change.leaseMs
        )
      }
      return {
        records: {
          ...collections,
          media_files: current.map(item => item.id === latest.id ? scheduled : item)
        },
        result: true
      }
    }
  )
  data.claimUploadDeletion = async change => data.transaction(
    ['media_files'],
    collections => {
      const current = collections.media_files
      const latest = current.find(item => item.id === change.id && item.ownerUserId === change.userId)
      const hasActiveClaim = Boolean(
        latest?.status === 'deleting' &&
        (latest.deletingAt ?? 0) > change.deletingAt - 5 * 60 * 1000
      )
      if (!latest || hasActiveClaim ||
        (change.expectedStatus && latest.status !== change.expectedStatus)) {
        return { records: collections, result: null }
      }
      if (latest.resourceType) throw new ForbiddenException('UPLOAD_ALREADY_ATTACHED')
      const claimed = { ...latest, status: 'deleting', deletingAt: change.deletingAt }
      return {
        records: {
          ...collections,
          media_files: current.map(item => item.id === latest.id ? claimed : item)
        },
        result: claimed
      }
    }
  )
  data.getAvatarUploadPath = async (userId, uploadId, purpose) => {
    const records = await data.read('media_files')
    return records.find(item =>
      item.id === uploadId && item.ownerUserId === userId && item.purpose === purpose
    )?.path ?? null
  }
  data.setProfileAvatar = async change => data.transaction(
    ['accounts', 'profiles', 'media_files'],
    collections => {
      avatars.assertOwnsProfileInRecords(
        change.userId, change.profileId, collections.accounts, collections.profiles
      )
      const profile = collections.profiles.find(item => item.id === change.profileId)
      if (!profile) throw new NotFoundException('PROFILE_NOT_FOUND')
      const nextRecords = change.uploadId
        ? avatars.attachAvatarRecordToRecords(
            collections.media_files, change.userId, change.uploadId,
            'profile-avatar', 'profile', change.profileId
          )
        : collections.media_files
      return {
        records: {
          ...collections,
          profiles: collections.profiles.map(item =>
            item.id === change.profileId ? { ...item, picture: change.picture } : item
          ),
          media_files: nextRecords
        },
        result: { previousPicture: profile.picture }
      }
    }
  )
  data.setCommunityAvatar = async change => data.transaction(
    ['accounts', 'profiles', 'communities', 'community_relationships', 'media_files'],
    collections => {
      avatars.assertOwnsProfileInRecords(
        change.userId, change.actorProfileId, collections.accounts, collections.profiles
      )
      const actor = collections.profiles.find(item => item.id === change.actorProfileId)
      const community = collections.communities.find(item => item.id === change.communityId)
      const ownerProfileId = collections.community_relationships.find(item =>
        item.profiles[1] === change.communityId && item.type === 'owner'
      )?.profiles[0]
      const owner = ownerProfileId
        ? collections.profiles.find(item => item.id === ownerProfileId)
        : undefined
      if (!actor || !community || !owner) throw new NotFoundException('COMMUNITY_NOT_FOUND')
      if (actor.type !== owner.type) throw new ForbiddenException('PROFILE_TYPE_MISMATCH')
      const role = collections.community_relationships.find(item =>
        item.profiles[0] === change.actorProfileId && item.profiles[1] === change.communityId
      )?.type
      if (role !== 'owner' && role !== 'moderator') {
        throw new ForbiddenException('COMMUNITY_STAFF_REQUIRED')
      }
      const nextRecords = change.uploadId
        ? avatars.attachAvatarRecordToRecords(
            collections.media_files, change.userId, change.uploadId,
            'community-avatar', 'community', change.communityId
          )
        : collections.media_files
      return {
        records: {
          ...collections,
          communities: collections.communities.map(item =>
            item.id === change.communityId ? { ...item, picture: change.picture } : item
          ),
          media_files: nextRecords
        },
        result: { previousPicture: community.picture }
      }
    }
  )
  return {
    service: new UploadsService(data, storage, cleanup, content, avatars),
    collections,
    data
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

test('removes pending upload metadata when Storage cannot sign the upload', async t => {
  const { service, collections } = createHarness()
  withFetch(t, async () => new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  }))

  await assert.rejects(
    service.createUpload('user-1', {
      purpose: 'editor-image',
      contentType: 'image/png',
      size: pngHeader.length
    }),
    error => error.getStatus() === 503 && error.message === 'UPLOAD_SIGNING_FAILED'
  )
  assert.deepEqual(collections.get('media_files'), [])
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

test('ready editor completion does not return a URL after the 24-hour deadline', async t => {
  const file = {
    id: 'b23e4567-e89b-42d3-a456-426614174000',
    ownerUserId: 'user-1',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/user-1/expired-ready.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: pngHeader.length,
    status: 'ready',
    createdAt: Date.now() - 48 * 60 * 60 * 1000,
    completedAt: Date.now() - 24 * 60 * 60 * 1000,
    expiresAt: Date.now() - 1,
    resourceType: null,
    resourceId: null,
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const { service } = createHarness({ media_files: [file] })
  withFetch(t, async () => {
    throw new Error('Idempotent completion of an expired upload must not contact Storage')
  })

  await assert.rejects(
    service.completeUpload('user-1', file.id),
    error => error.getStatus() === 404 && error.message === 'UPLOAD_EXPIRED'
  )
})

test('profile-post images remain public and readable after upload retention expires', async t => {
  const file = {
    id: '123e4567-e89b-42d3-a456-426614174001',
    ownerUserId: 'author-user',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/author-user/profile-post.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: pngHeader.length,
    status: 'ready',
    createdAt: Date.now() - 48 * 60 * 60 * 1000,
    completedAt: Date.now() - 48 * 60 * 60 * 1000,
    expiresAt: Date.now() - 24 * 60 * 60 * 1000,
    resourceType: 'profile-post',
    resourceId: 'post-1',
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const { service } = createHarness({
    media_files: [file],
    profile_posts: [{ id: 'post-1', profileId: 'profile-1' }]
  })
  withFetch(t, async () => new Response(pngHeader, { status: 200 }))

  const image = await service.getEditorImage(null, file.id)
  assert.equal(image.contentType, 'image/png')
  assert.deepEqual(image.body, pngHeader)
})

test('profile-post images are not served after their source post is gone', async t => {
  const file = {
    id: '123e4567-e89b-42d3-a456-426614174002',
    ownerUserId: 'author-user',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/author-user/orphaned-profile-post.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: pngHeader.length,
    status: 'ready',
    createdAt: Date.now(),
    completedAt: Date.now(),
    expiresAt: Date.now() - 1,
    resourceType: 'profile-post',
    resourceId: 'deleted-post',
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const { service } = createHarness({ media_files: [file] })
  withFetch(t, async () => {
    throw new Error('Orphaned profile-post images must not reach Storage')
  })

  await assert.rejects(
    service.getEditorImage(null, file.id),
    error => error.getStatus() === 404 && error.message === 'UPLOAD_NOT_FOUND'
  )
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
    resourceType: null,
    resourceId: null,
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const { service } = createHarness({ media_files: [file], profiles: [{ id: 'profile-1' }] })
  withFetch(t, async () => {
    throw new Error('Expired objects must not reach Storage')
  })

  await assert.rejects(
    service.getEditorImage('user-1', file.id),
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

test('avatar replacement keeps the old object tombstone until its signed upload token is safe', async t => {
  const completedAt = Date.now()
  const file = {
    id: 'e23e4567-e89b-42d3-a456-426614174000',
    ownerUserId: 'user-1',
    purpose: 'profile-avatar',
    bucket: 'nexus-avatars',
    path: 'profiles/user-1/old-avatar.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: pngHeader.length,
    status: 'ready',
    createdAt: completedAt - 1000,
    completedAt,
    expiresAt: null,
    resourceType: 'profile',
    resourceId: 'profile-1',
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const picture = supabaseUrl + '/storage/v1/object/public/nexus-avatars/' + file.path
  const { service, collections } = createHarness({
    accounts: [{
      id: 'user-1', email: 'user@example.test',
      profiles: ['profile-1'], currentProfile: 'profile-1'
    }],
    profiles: [{ id: 'profile-1', picture, type: 'social' }],
    media_files: [file]
  })
  withFetch(t, async () => {
    throw new Error('Avatar replacement must schedule deletion instead of removing Storage immediately')
  })

  const result = await service.setProfileAvatar('user-1', 'profile-1', null)

  assert.equal(result.picture, '')
  const [scheduled] = collections.get('media_files')
  assert.equal(scheduled.status, 'deleting')
  assert.equal(scheduled.deleteAfter, completedAt + 3 * 60 * 60 * 1000)
})

test('deleteUpload rechecks ownership inside the deletion claim snapshot', async t => {
  const file = {
    id: 'c23e4567-e89b-42d3-a456-426614174000',
    ownerUserId: 'user-1',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/user-1/reassigned.png',
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
  const reassigned = { ...file, ownerUserId: 'user-2' }
  let transactionCount = 0
  const { service, collections } = createHarness(
    { media_files: [file] },
    null,
    (names, current) => {
      transactionCount += 1
      assert.deepEqual([...names], ['media_files'])
      current.set('media_files', [reassigned])
    }
  )
  withFetch(t, async () => {
    throw new Error('A caller who no longer owns the upload must not delete it')
  })

  await service.deleteUpload('user-1', file.id)

  assert.equal(transactionCount, 1)
  assert.deepEqual(collections.get('media_files'), [reassigned])
})

test('expired pending cleanup does not delete an upload another request has completed', async t => {
  const file = {
    id: 'd23e4567-e89b-42d3-a456-426614174000',
    ownerUserId: 'user-1',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/user-1/completed-concurrently.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: null,
    status: 'pending',
    createdAt: Date.now() - 3 * 60 * 60 * 1000,
    completedAt: null,
    expiresAt: null,
    resourceType: null,
    resourceId: null,
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const completed = {
    ...file,
    size: pngHeader.length,
    status: 'ready',
    completedAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000
  }
  const { service, collections } = createHarness({ media_files: [file] }, null, (names, current) => {
    if (names.includes('media_files')) current.set('media_files', [completed])
  })
  withFetch(t, async () => {
    throw new Error('Expired preflight must not delete a record that is already ready')
  })

  await assert.rejects(
    service.completeUpload('user-1', file.id),
    error => error.getStatus() === 404 && error.message === 'UPLOAD_EXPIRED'
  )
  assert.deepEqual(collections.get('media_files'), [completed])
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
    resourceType: null,
    resourceId: null,
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

test('profile avatar presign checks ownership in the metadata-creation snapshot', async t => {
  let transactionCount = 0
  const { service, collections } = createHarness({
    accounts: [{
      id: 'user-1', email: 'user@example.test',
      profiles: ['profile-1'], currentProfile: 'profile-1'
    }],
    profiles: [{ id: 'profile-1', type: 'social' }]
  }, 'profile-1', (names, current) => {
    transactionCount += 1
    assert.deepEqual([...names].sort(), ['accounts', 'media_files', 'profiles'])
    current.set('accounts', [])
  })
  withFetch(t, async () => {
    throw new Error('Unauthorized avatar presigns must not create a Storage upload URL')
  })

  await assert.rejects(
    service.createUpload('user-1', {
      purpose: 'profile-avatar',
      targetId: 'profile-1',
      contentType: 'image/png',
      size: pngHeader.length
    }),
    error => error.getStatus() === 403 && error.message === 'PROFILE_NOT_OWNED'
  )
  assert.equal(transactionCount, 1)
  assert.deepEqual(collections.get('media_files') ?? [], [])
})

test('community avatar presign checks ownership and staff role in one snapshot', async t => {
  let transactionCount = 0
  const { service } = createHarness({
    accounts: [{
      id: 'user-1', email: 'user@example.test',
      profiles: ['moderator-profile'], currentProfile: 'moderator-profile'
    }],
    profiles: [
      { id: 'owner-profile', type: 'social' },
      { id: 'moderator-profile', type: 'social' }
    ],
    communities: [{ id: 'community-1', type: 'social' }],
    community_relationships: [
      { profiles: ['owner-profile', 'community-1'], type: 'owner' },
      { profiles: ['moderator-profile', 'community-1'], type: 'moderator' }
    ]
  }, 'moderator-profile', (names, current) => {
    transactionCount += 1
    assert.deepEqual([...names].sort(), [
      'accounts', 'communities', 'community_relationships', 'media_files', 'profiles'
    ])
    current.set('community_relationships', [
      { profiles: ['owner-profile', 'community-1'], type: 'owner' },
      { profiles: ['moderator-profile', 'community-1'], type: 'connection' }
    ])
  })
  withFetch(t, async () => {
    throw new Error('Unauthorized avatar presigns must not create a Storage upload URL')
  })

  await assert.rejects(
    service.createUpload('user-1', {
      purpose: 'community-avatar',
      targetId: 'community-1',
      actorProfileId: 'moderator-profile',
      contentType: 'image/png',
      size: pngHeader.length
    }),
    error => error.getStatus() === 403 && error.message === 'COMMUNITY_STAFF_REQUIRED'
  )
  assert.equal(transactionCount, 1)
})

test('community avatar uploads reject staff profiles with a different type', async () => {
  const { service } = createHarness({
    accounts: [{
      id: 'user-1', email: 'user@example.test',
      profiles: ['profile-1'], currentProfile: 'profile-1'
    }],
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
  const attached = service.attachAvatarUrlToRecords(
    [file], 'user-1', url, 'profile-avatar', 'profile', 'profile-1'
  )
  assert.equal(attached[0].resourceType, 'profile')
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

  assert.throws(
    () => service.attachAvatarUrlToRecords(
      [file], 'user-1', url, 'profile-avatar', 'profile', 'profile-1'
    ),
    error => error.getStatus() === 400 && error.message === 'INVALID_AVATAR_UPLOAD'
  )
  await assert.rejects(
    service.setProfileAvatar('user-1', 'profile-1', file.id),
    error => error.getStatus() === 400 && error.message === 'INVALID_AVATAR_UPLOAD'
  )
})

test('profile avatar upload cannot target a profile of another type than the active profile', async () => {
  const { service } = createHarness({
    accounts: [{
      id: 'user-1', email: 'user@example.test',
      profiles: ['profile-1', 'profile-2'], currentProfile: 'profile-2'
    }],
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


test('partial upload cleanup continues across buckets and retries failed deletion claims', async t => {
  const now = Date.now()
  const editor = {
    id: 'f23e4567-e89b-42d3-a456-426614174000',
    ownerUserId: 'user-1',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/user-1/expired.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: pngHeader.length,
    status: 'ready',
    createdAt: now - 48 * 60 * 60 * 1000,
    completedAt: now - 48 * 60 * 60 * 1000,
    expiresAt: now - 24 * 60 * 60 * 1000,
    resourceType: null,
    resourceId: null,
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const avatar = {
    id: 'f23e4567-e89b-42d3-a456-426614174001',
    ownerUserId: 'user-1',
    purpose: 'profile-avatar',
    bucket: 'nexus-avatars',
    path: 'profiles/user-1/abandoned.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: pngHeader.length,
    status: 'ready',
    createdAt: now - 48 * 60 * 60 * 1000,
    completedAt: now - 48 * 60 * 60 * 1000,
    expiresAt: null,
    resourceType: null,
    resourceId: null,
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const { service, collections } = createHarness({
    media_files: [editor, avatar]
  })
  const requests = []
  let failAvatarBucket = true
  withFetch(t, async (url, init) => {
    assert.equal(init.method, 'DELETE')
    const target = String(url)
    requests.push(target)
    if (failAvatarBucket && target.endsWith('/nexus-avatars')) {
      return new Response(JSON.stringify({ message: 'Storage unavailable' }), {
        status: 503,
        headers: { 'content-type': 'application/json' }
      })
    }
    return new Response(null, { status: 200 })
  })

  await assert.rejects(
    service.cleanupExpired(cronSecret),
    error => error.getStatus() === 503 && error.message === 'UPLOAD_CLEANUP_PARTIAL_FAILURE'
  )

  assert.deepEqual(
    requests.map(url => url.split('/').pop()),
    ['nexus-avatars', 'nexus-editor-images']
  )
  assert.deepEqual(collections.get('media_files').map(item => ({
    id: item.id,
    status: item.status
  })), [{ id: avatar.id, status: 'deleting' }])

  const originalNow = Date.now
  Date.now = () => now + 6 * 60 * 1000
  t.after(() => { Date.now = originalNow })
  failAvatarBucket = false

  const retry = await service.cleanupExpired(cronSecret)

  assert.equal(retry.deleted, 1)
  assert.deepEqual(collections.get('media_files'), [])
  assert.equal(requests.filter(url => url.endsWith('/nexus-avatars')).length, 2)
})

test('deleteUpload can reclaim a deletion claim after its lease expires', async t => {
  const now = Date.now()
  const file = {
    id: 'f23e4567-e89b-42d3-a456-426614174002',
    ownerUserId: 'user-1',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/user-1/stale-delete.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: pngHeader.length,
    status: 'deleting',
    deletingAt: now - 6 * 60 * 1000,
    createdAt: now - 7 * 60 * 1000,
    completedAt: now - 7 * 60 * 1000,
    expiresAt: now + 60 * 60 * 1000,
    resourceType: null,
    resourceId: null,
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const { service, collections } = createHarness({ media_files: [file] })
  let deletionCount = 0
  withFetch(t, async (_url, init) => {
    assert.equal(init.method, 'DELETE')
    deletionCount += 1
    return new Response(null, { status: 200 })
  })

  await service.deleteUpload('user-1', file.id)

  assert.equal(deletionCount, 1)
  assert.deepEqual(collections.get('media_files'), [])
})


test('cancelling a pending upload keeps a tombstone until its signed URL expires plus grace', async t => {
  const createdAt = Date.now()
  let now = createdAt
  const originalNow = Date.now
  Date.now = () => now
  t.after(() => { Date.now = originalNow })

  const file = {
    id: 'f23e4567-e89b-42d3-a456-426614174099',
    ownerUserId: 'user-1',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/user-1/cancelled-in-flight.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: null,
    status: 'pending',
    createdAt,
    completedAt: null,
    expiresAt: null,
    resourceType: null,
    resourceId: null,
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const { service, collections } = createHarness({ media_files: [file] })
  const deletedPaths = []
  withFetch(t, async (url, init) => {
    assert.equal(init.method, 'DELETE')
    deletedPaths.push(JSON.parse(init.body).prefixes[0])
    return new Response(null, { status: 200 })
  })

  await service.deleteUpload('user-1', file.id)

  const tombstone = collections.get('media_files')[0]
  assert.equal(tombstone.status, 'deleting')
  assert.equal(tombstone.deleteAfter, createdAt + 3 * 60 * 60 * 1000)
  assert.deepEqual(deletedPaths, [])

  now = createdAt + 2 * 60 * 60 * 1000 + 1
  const beforeExpiry = await service.cleanupExpired(cronSecret)
  assert.deepEqual(beforeExpiry, { deleted: 0 })
  assert.equal(collections.get('media_files').length, 1)
  assert.deepEqual(deletedPaths, [])

  // Simulate the upload finishing after cancellation but before the token's
  // expiry-plus-grace deadline. The final cleanup must still remove it.
  now = createdAt + 3 * 60 * 60 * 1000 + 1
  const afterExpiry = await service.cleanupExpired(cronSecret)

  assert.deepEqual(afterExpiry, { deleted: 1 })
  assert.deepEqual(deletedPaths, [file.path])
  assert.deepEqual(collections.get('media_files'), [])
})

test('expired completion schedules pending cleanup instead of revoking metadata before token expiry', async t => {
  const createdAt = Date.now() - 2 * 60 * 60 * 1000 - 1
  const file = {
    id: 'f23e4567-e89b-42d3-a456-426614174098',
    ownerUserId: 'user-1',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/user-1/late-completion.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: null,
    status: 'pending',
    createdAt,
    completedAt: null,
    expiresAt: null,
    resourceType: null,
    resourceId: null,
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const { service, collections } = createHarness({ media_files: [file] })
  withFetch(t, async () => {
    throw new Error('An expired completion must schedule cleanup without touching Storage')
  })

  await assert.rejects(
    service.completeUpload('user-1', file.id),
    error => error.getStatus() === 404 && error.message === 'UPLOAD_EXPIRED'
  )

  const [saved] = collections.get('media_files')
  assert.equal(saved.status, 'deleting')
  assert.ok(saved.deleteAfter > Date.now())
})


test('deleting a recently completed upload defers Storage removal until its signed token is safe', async t => {
  const createdAt = Date.now()
  const file = {
    id: 'f23e4567-e89b-42d3-a456-426614174097',
    ownerUserId: 'user-1',
    purpose: 'profile-avatar',
    bucket: 'nexus-avatars',
    path: 'profiles/user-1/recently-deleted.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: pngHeader.length,
    status: 'ready',
    createdAt: createdAt - 1000,
    completedAt: createdAt,
    expiresAt: null,
    resourceType: null,
    resourceId: null,
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const { service, collections } = createHarness({ media_files: [file] })
  withFetch(t, async (_url, init) => {
    assert.equal(init.method, 'DELETE')
    return new Response(null, { status: 200 })
  })

  await service.deleteUpload('user-1', file.id)

  const [scheduled] = collections.get('media_files')
  assert.equal(scheduled.status, 'deleting')
  assert.equal(scheduled.deleteAfter, createdAt + 3 * 60 * 60 * 1000)
})

test('Storage unavailability during upload completion remains retryable', async t => {
  const file = {
    id: 'f23e4567-e89b-42d3-a456-426614174003',
    ownerUserId: 'user-1',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/user-1/retry-completion.png',
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
    return new Response(JSON.stringify({ message: 'Storage unavailable' }), {
      status: 503,
      headers: { 'content-type': 'application/json' }
    })
  })

  await assert.rejects(
    service.completeUpload('user-1', file.id),
    error => error.getStatus() === 503 && error.message === 'UPLOAD_STORAGE_REQUEST_FAILED'
  )
  assert.equal(collections.get('media_files')[0].status, 'pending')
})

test('Storage network failures are normalized and do not silently complete uploads', async t => {
  const file = {
    id: 'f23e4567-e89b-42d3-a456-426614174004',
    ownerUserId: 'user-1',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/user-1/network-failure.png',
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
  withFetch(t, async () => {
    throw new TypeError('fetch failed')
  })

  await assert.rejects(
    service.completeUpload('user-1', file.id),
    error => error.getStatus() === 503 && error.message === 'UPLOAD_STORAGE_REQUEST_FAILED'
  )
  assert.equal(collections.get('media_files')[0].status, 'pending')
})


test('expired upload cleanup splits Storage deletion requests at the 1000-object limit', async t => {
  const now = Date.now()
  const files = Array.from({ length: 1001 }, (_, index) => ({
    id: 'a' + String(index).padStart(35, '0'),
    ownerUserId: 'user-1',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/user-1/expired-' + index + '.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: pngHeader.length,
    status: 'ready',
    createdAt: now - 48 * 60 * 60 * 1000,
    completedAt: now - 48 * 60 * 60 * 1000,
    expiresAt: now - 24 * 60 * 60 * 1000,
    resourceType: null,
    resourceId: null,
    messageFromProfileId: null,
    messageToProfileId: null
  }))
  const { service, collections } = createHarness({ media_files: files })
  const batchSizes = []
  withFetch(t, async (_url, init) => {
    assert.equal(init.method, 'DELETE')
    const prefixes = JSON.parse(init.body).prefixes
    batchSizes.push(prefixes.length)
    assert.ok(prefixes.length <= 1000)
    return new Response(null, { status: 200 })
  })

  const result = await service.cleanupExpired(cronSecret)

  assert.equal(result.deleted, 1001)
  assert.deepEqual(batchSizes, [1000, 1])
  assert.deepEqual(collections.get('media_files'), [])
})


test('legacy deleting editor attachments remain readable and protected from cleanup while their source exists', async t => {
  const now = Date.now()
  const file = {
    id: '423e4567-e89b-42d3-a456-426614174111',
    ownerUserId: 'author-user',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/author-user/legacy-deleting-post.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: pngHeader.length,
    status: 'deleting',
    deletingAt: now - 10 * 60 * 1000,
    createdAt: now - 48 * 60 * 60 * 1000,
    completedAt: now - 48 * 60 * 60 * 1000,
    expiresAt: null,
    resourceType: 'profile-post',
    resourceId: 'post-legacy',
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const { service, collections } = createHarness({
    media_files: [file],
    profile_posts: [{ id: 'post-legacy', profileId: 'profile-1' }]
  })
  withFetch(t, async (_url, init) => {
    if (init.method === 'DELETE') throw new Error('Live attachments must not be removed')
    return new Response(pngHeader, { status: 200 })
  })

  const cleanup = await service.cleanupExpired(cronSecret)
  assert.deepEqual(cleanup, { deleted: 0 })
  const image = await service.getEditorImage(null, file.id)
  assert.deepEqual(image.body, pngHeader)
  assert.deepEqual(collections.get('media_files'), [file])
})

test('finishUploadDeletions does not remove a claimed editor image while its source exists', async () => {
  const file = {
    id: '423e4567-e89b-42d3-a456-426614174112',
    ownerUserId: 'author-user',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/author-user/inflight-post.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: pngHeader.length,
    status: 'deleting',
    deletingAt: 1234,
    createdAt: 1,
    completedAt: 1,
    expiresAt: null,
    resourceType: 'profile-post',
    resourceId: 'post-inflight',
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const { data, collections } = createHarness({
    media_files: [file],
    profile_posts: [{ id: 'post-inflight', profileId: 'profile-1' }]
  })

  const deleted = await data.finishUploadDeletions([{ id: file.id, deletingAt: file.deletingAt }])

  assert.equal(deleted, 0)
  assert.deepEqual(collections.get('media_files'), [file])
})

test('cleanup removes editor images whose source content was deleted', async t => {
  const now = Date.now()
  const file = {
    id: '323e4567-e89b-42d3-a456-426614174111',
    ownerUserId: 'author-user',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/author-user/orphaned-post.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: pngHeader.length,
    status: 'ready',
    createdAt: now - 48 * 60 * 60 * 1000,
    completedAt: now - 48 * 60 * 60 * 1000,
    expiresAt: null,
    resourceType: 'profile-post',
    resourceId: 'deleted-post',
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const { service, collections } = createHarness({
    media_files: [file],
    profile_posts: []
  })
  const deletedPaths = []
  withFetch(t, async (url, init) => {
    assert.equal(init.method, 'DELETE')
    deletedPaths.push(...JSON.parse(init.body).prefixes)
    return new Response(null, { status: 200 })
  })

  const result = await service.cleanupExpired(cronSecret)

  assert.deepEqual(result, { deleted: 1 })
  assert.deepEqual(deletedPaths, [file.path])
  assert.deepEqual(collections.get('media_files'), [])
})

test('cleanup removes avatar records whose profile was deleted after safe retention', async t => {
  const now = Date.now()
  const file = {
    id: '323e4567-e89b-42d3-a456-426614174112',
    ownerUserId: 'author-user',
    purpose: 'profile-avatar',
    bucket: 'nexus-avatars',
    path: 'profiles/author-user/deleted-profile.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: pngHeader.length,
    status: 'ready',
    createdAt: now - 48 * 60 * 60 * 1000,
    completedAt: now - 48 * 60 * 60 * 1000,
    expiresAt: null,
    resourceType: 'profile',
    resourceId: 'deleted-profile',
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const { service, collections } = createHarness({
    media_files: [file],
    profiles: []
  })
  const deletedPaths = []
  withFetch(t, async (url, init) => {
    assert.equal(init.method, 'DELETE')
    deletedPaths.push(...JSON.parse(init.body).prefixes)
    return new Response(null, { status: 200 })
  })

  const result = await service.cleanupExpired(cronSecret)

  assert.deepEqual(result, { deleted: 1 })
  assert.deepEqual(deletedPaths, [file.path])
  assert.deepEqual(collections.get('media_files'), [])
})

test('does not claim expired editor images while they are attached to a profile post', async t => {
  const file = {
    id: '223e4567-e89b-42d3-a456-426614174001',
    ownerUserId: 'author-user',
    purpose: 'editor-image',
    bucket: 'nexus-editor-images',
    path: 'editor/author-user/attached-post.png',
    contentType: 'image/png',
    expectedSize: pngHeader.length,
    size: pngHeader.length,
    status: 'ready',
    createdAt: Date.now() - 48 * 60 * 60 * 1000,
    completedAt: Date.now() - 48 * 60 * 60 * 1000,
    expiresAt: Date.now() - 24 * 60 * 60 * 1000,
    resourceType: 'profile-post',
    resourceId: 'post-2',
    messageFromProfileId: null,
    messageToProfileId: null
  }
  const { service, collections } = createHarness({
    media_files: [file],
    profile_posts: [{ id: 'post-2', profileId: 'profile-1' }]
  })
  withFetch(t, async () => {
    throw new Error('Attached images must not be deleted from Storage')
  })

  const result = await service.cleanupExpired(cronSecret)

  assert.deepEqual(result, { deleted: 0 })
  assert.deepEqual(collections.get('media_files'), [file])
})

test('expired pending upload metadata is recovered when Storage signing rollback fails', async t => {
  const now = Date.now()
  let currentTime = now
  const originalNow = Date.now
  Date.now = () => currentTime
  t.after(() => { Date.now = originalNow })

  let failRollback = true
  const { service, collections } = createHarness(
    {},
    null,
    undefined,
    name => {
      if (name === 'media_files' && failRollback) {
        failRollback = false
        throw new Error('Temporary metadata write failure')
      }
    }
  )
  withFetch(t, async (_url, init) => {
    if (init.method === 'POST') {
      return new Response(JSON.stringify({ message: 'Storage unavailable' }), {
        status: 503,
        headers: { 'content-type': 'application/json' }
      })
    }
    assert.equal(init.method, 'DELETE')
    const body = JSON.parse(init.body)
    assert.deepEqual(body.prefixes, [orphaned.path])
    return new Response(null, { status: 200 })
  })

  await assert.rejects(
    service.createUpload('user-1', {
      purpose: 'editor-image',
      contentType: 'image/png',
      size: pngHeader.length
    }),
    error => error.getStatus() === 503 && error.message === 'UPLOAD_STORAGE_REQUEST_FAILED'
  )

  const [orphaned] = collections.get('media_files')
  assert.equal(orphaned.status, 'pending')

  currentTime = now + 3 * 60 * 60 * 1000

  const cleanup = await service.cleanupExpired(cronSecret)

  assert.equal(cleanup.deleted, 1)
  assert.deepEqual(collections.get('media_files'), [])
})
