const test = require('node:test')
const assert = require('node:assert/strict')
const { NotFoundException } = require('@nestjs/common')
const { UploadsStorageService } = require('../dist/api/uploads/uploads.storage.service.js')
const { UploadsContentService } = require('../dist/api/uploads/uploads.content.service.js')
const { UploadsService } = require('../dist/api/uploads/uploads.service.js')
const { UploadsAvatarService } = require('../dist/api/uploads/uploads.avatar.service.js')
const { UploadsCleanupService } = require('../dist/api/uploads/uploads.cleanup.service.js')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const image = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])
const migration = readFileSync(join(__dirname, '../sql/069_private_community_avatars.sql'), 'utf8')
const serverAuth = readFileSync(join(__dirname, '../sql/002_nexus_collection_private_rls.sql'), 'utf8')
const relationalSchema = readFileSync(join(__dirname, '../sql/007_relational_social_schema.sql'), 'utf8')

function storage() {
  return new UploadsStorageService({
    get(name) {
      return {
        SUPABASE_URL: 'https://project.example.supabase.co',
        SUPABASE_STORAGE_SECRET_KEY: 'sb_secret_test'
      }[name]
    }
  })
}

function sqlFunction(name) {
  const start = migration.indexOf(`create or replace function public.${name}(`)
  assert.notEqual(start, -1, `migration must define ${name}`)
  const end = migration.indexOf('$function$;', start)
  assert.notEqual(end, -1, `${name} must have a complete body`)
  return migration.slice(start, end)
}

test('community-avatar uploads use the dedicated private Storage bucket', async t => {
  const originalFetch = global.fetch
  t.after(() => { global.fetch = originalFetch })
  let record
  global.fetch = async url => {
    assert.match(String(url), /\/object\/upload\/sign\/nexus-community-avatars\//)
    return new Response(JSON.stringify({
      url: '/object/upload/sign/nexus-community-avatars/path?token=test'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  const data = { async createUpload(change) { record = change.record } }
  const service = new UploadsService(data, storage(), {}, {}, {})
  const result = await service.createUpload('owner-user', {
    purpose: 'community-avatar', contentType: 'image/png', size: image.length
  })

  assert.equal(record.bucket, 'nexus-community-avatars')
  assert.match(record.path, /^communities\/owner-user\//)
  assert.equal(typeof result.id, 'string')
})

test('community-avatar route resolves only after the authorization RPC returns a media record', async t => {
  const originalFetch = global.fetch
  t.after(() => { global.fetch = originalFetch })
  const record = {
    id: '123e4567-e89b-42d3-a456-426614174000',
    ownerUserId: 'owner-user',
    purpose: 'community-avatar',
    bucket: 'nexus-community-avatars',
    path: 'communities/owner-user/avatar.png',
    contentType: 'image/png',
    expectedSize: image.length,
    size: image.length,
    status: 'ready',
    createdAt: 1,
    completedAt: 2,
    expiresAt: null,
    resourceType: 'community',
    resourceId: 'community-1',
    messageFromProfileId: null,
    messageToProfileId: null
  }
  let rpcRequest
  let storageRequest
  const data = {
    async getCommunityAvatarRecord(request) {
      rpcRequest = request
      return record
    }
  }
  global.fetch = async (url, init) => {
    storageRequest = { url, init }
    return new Response(image, { status: 200, headers: { 'Content-Type': 'image/png' } })
  }

  const service = new UploadsContentService(data, storage())
  const result = await service.getCommunityAvatar('member-user', record.id)

  assert.deepEqual(rpcRequest, { userId: 'member-user', id: record.id })
  assert.equal(storageRequest.url, 'https://project.example.supabase.co/storage/v1/object/nexus-community-avatars/communities/owner-user/avatar.png')
  assert.equal(storageRequest.init.headers.get('apikey'), 'sb_secret_test')
  assert.equal(storageRequest.init.headers.has('authorization'), false)
  assert.deepEqual(result.body, image)
  assert.equal(result.contentType, 'image/png')
})

test('unauthorized community-avatar read stops before requesting Storage bytes', async t => {
  const originalFetch = global.fetch
  t.after(() => { global.fetch = originalFetch })
  let storageRequests = 0
  global.fetch = async () => {
    storageRequests += 1
    throw new Error('Storage request must not occur')
  }
  const data = { async getCommunityAvatarRecord() { throw new Error('UPLOAD_NOT_FOUND') } }
  const service = new UploadsContentService(data, storage())

  await assert.rejects(
    service.getCommunityAvatar(null, '123e4567-e89b-42d3-a456-426614174000'),
    error => error instanceof NotFoundException && error.message === 'UPLOAD_NOT_FOUND'
  )
  assert.equal(storageRequests, 0)
})

test('community avatar URL parser rejects foreign origins and malformed UUIDs', () => {
  const instance = storage()
  const id = '123e4567-e89b-42d3-a456-426614174000'
  assert.equal(instance.communityAvatarUrl(id), '/api/uploads/community-avatars/' + id + '/content')
  assert.equal(instance.getCommunityAvatarId('/api/uploads/community-avatars/' + id + '/content'), id)
  assert.equal(instance.getCommunityAvatarId('https://evil.example/api/uploads/community-avatars/' + id + '/content'), null)
  assert.equal(instance.getCommunityAvatarId('/api/uploads/community-avatars/not-a-uuid/content'), null)
  assert.equal(instance.getCommunityAvatarId('/api/uploads/community-avatars/' + id + '/content?cache=1'), null)
  assert.equal(instance.getCommunityAvatarId('/API/uploads/community-avatars/' + id + '/content'), null)
})

test('migration defines a non-public dedicated bucket while keeping profile avatars public', () => {
  assert.match(migration, /'nexus-community-avatars'[\s\S]*?false/i)
  assert.match(sqlFunction('nexus_create_upload'), /p_purpose='profile-avatar'[\s\S]*?p_bucket<>'nexus-avatars'/i)
  assert.match(sqlFunction('nexus_create_upload'), /p_purpose='community-avatar'[\s\S]*?p_bucket<>'nexus-community-avatars'/i)
})

test('community avatar write RPCs bind the image URL to the exact owned upload ID', () => {
  const setAvatar = sqlFunction('nexus_set_community_avatar')
  const createSql = sqlFunction('nexus_create_community')
  const updateSql = sqlFunction('nexus_update_community')
  assert.match(setAvatar, /p_picture is distinct from .*p_upload_id::text/i)
  assert.match(createSql, /file\.id=substring\(p_picture from/i)
  assert.match(updateSql, /file\.id=substring\(p_picture from/i)
  assert.match(createSql, /where public\.media_files\.id=substring\(p_picture from/i)
  assert.match(updateSql, /where public\.media_files\.id=substring\(p_picture from/i)
})

test('private community avatar reads require effective-type matching membership', () => {
  const sql = sqlFunction('nexus_get_community_avatar')
  assert.match(sql, /v_privacy='private'/i)
  assert.match(sql, /owner_relation\.type='owner'/i)
  assert.match(sql, /coalesce\([\s\S]*owner_profile\.type[\s\S]*community\.type/i)
  assert.match(sql, /member_profile\.type=v_community_type/i)
  assert.match(sql, /relation\.type in \('owner','moderator','connection'\)/i)
  assert.match(sql, /resource_type is distinct from 'community'/i)
  assert.match(sql, /v_privacy is null or v_privacy not in \('public','unlisted','private'\)/i)
})

test('creating or replacing a managed community avatar requires an owned upload path', () => {
  const createSql = sqlFunction('nexus_create_community')
  const updateSql = sqlFunction('nexus_update_community')
  assert.match(createSql, /p_picture ~\* '\^\/api\/uploads\/community-avatars\//i)
  assert.match(createSql, /p_avatar_path is null[\s\S]*INVALID_AVATAR_UPLOAD/i)
  assert.match(updateSql, /v_picture_changed and p_picture ~\*[\s\S]*p_avatar_path is null/i)
})

test('ordinary community edits only detach old avatars when the image actually changes', () => {
  const sql = sqlFunction('nexus_update_community')
  assert.match(sql, /purpose='editor-image'[\s\S]*not\(public\.media_files\.id=any\(v_image_ids\)\)/i)
  assert.match(sql, /purpose='community-avatar'[\s\S]*v_picture_changed/i)
})

test('private community avatar deletion only schedules files in the private bucket', () => {
  const sql = sqlFunction('nexus_schedule_previous_community_avatar_deletion')
  assert.match(sql, /file\.purpose='community-avatar'/i)
  assert.match(sql, /file\.bucket='nexus-community-avatars'/i)
})


test('community avatar replacement schedules the previous private record and preserves the new upload', async () => {
  const oldId = '223e4567-e89b-42d3-a456-426614174000'
  const newId = '323e4567-e89b-42d3-a456-426614174000'
  const oldPicture = '/api/uploads/community-avatars/' + oldId + '/content'
  const newPicture = '/api/uploads/community-avatars/' + newId + '/content'
  const deletionSchedules = []
  const avatarWrites = []
  const cleanupRepository = {
    async schedulePreviousCommunityAvatarDeletion(change) {
      deletionSchedules.push(change)
    },
    async schedulePreviousAvatarDeletion() {
      throw new Error('Private community avatars must not use the public profile-avatar cleanup RPC')
    }
  }
  const cleanup = new UploadsCleanupService(
    cleanupRepository,
    { get(name) { return name === 'CRON_SECRET' ? 'cron-secret-test' : undefined } },
    storage()
  )
  const repository = {
    async getAvatarUploadPath(userId, uploadId, purpose) {
      assert.deepEqual([userId, uploadId, purpose], [
        'owner-user', newId, 'community-avatar'
      ])
      return 'communities/owner-user/new-avatar.png'
    },
    async setCommunityAvatar(change) {
      avatarWrites.push(change)
      return { previousPicture: oldPicture }
    }
  }
  const service = new UploadsAvatarService(repository, storage(), cleanup)
  const startedAt = Date.now()

  const result = await service.setCommunityAvatar(
    'owner-user', 'community-1', 'owner-profile', newId
  )

  assert.deepEqual(result, { picture: newPicture })
  assert.deepEqual(avatarWrites, [{
    userId: 'owner-user',
    communityId: 'community-1',
    actorProfileId: 'owner-profile',
    uploadId: newId,
    picture: newPicture
  }])
  assert.equal(deletionSchedules.length, 1)
  assert.equal(deletionSchedules[0].id, oldId)
  assert.equal(deletionSchedules[0].keepId, newId)
  assert.ok(deletionSchedules[0].deletingAt >= startedAt)
  assert.equal(deletionSchedules[0].safeAge, 3 * 60 * 60 * 1000)
  assert.equal(deletionSchedules[0].leaseMs, 5 * 60 * 1000)
})

test('expired community avatar objects are removed from the private bucket and their records finalized', async t => {
  const originalFetch = global.fetch
  t.after(() => { global.fetch = originalFetch })
  const file = {
    id: '423e4567-e89b-42d3-a456-426614174000',
    ownerUserId: 'owner-user',
    purpose: 'community-avatar',
    bucket: 'nexus-community-avatars',
    path: 'communities/owner-user/expired-avatar.png',
    contentType: 'image/png',
    expectedSize: image.length,
    size: image.length,
    status: 'deleting',
    createdAt: 1,
    completedAt: 2,
    expiresAt: null,
    resourceType: 'community',
    resourceId: 'community-1',
    deletingAt: 123,
    messageFromProfileId: null,
    messageToProfileId: null
  }
  let storageDelete
  let finalizedClaims
  const repository = {
    async claimExpiredUploads() { return [file] },
    async finishUploadDeletions(claims) {
      finalizedClaims = claims
      return claims.length
    }
  }
  global.fetch = async (url, init) => {
    storageDelete = { url: String(url), init }
    return new Response(null, { status: 200 })
  }
  const cleanup = new UploadsCleanupService(
    repository,
    { get(name) { return name === 'CRON_SECRET' ? 'cron-secret-test' : undefined } },
    storage()
  )

  const result = await cleanup.cleanupExpired('cron-secret-test')

  assert.deepEqual(result, { deleted: 1 })
  assert.equal(
    storageDelete.url,
    'https://project.example.supabase.co/storage/v1/object/nexus-community-avatars'
  )
  assert.deepEqual(JSON.parse(storageDelete.init.body), {
    prefixes: ['communities/owner-user/expired-avatar.png']
  })
  assert.equal(storageDelete.init.method, 'DELETE')
  assert.deepEqual(finalizedClaims, [{
    id: file.id,
    deletingAt: file.deletingAt
  }])
})


test('private avatar RPCs remain behind the server-secret RLS gate', () => {
  const readRpc = sqlFunction('nexus_get_community_avatar')
  const cleanupRpc = sqlFunction('nexus_schedule_previous_community_avatar_deletion')

  for (const sql of [readRpc, cleanupRpc]) {
    assert.match(sql, /language plpgsql\s+security invoker/i)
    assert.doesNotMatch(sql, /security definer/i)
  }

  assert.match(
    serverAuth,
    /presented_secret := request_headers ->> 'x-nexus-api-secret'/i
  )
  assert.match(
    relationalSchema,
    /'refresh_tokens',\s*'media_files',\s*'feed_activities'/i
  )
  assert.match(relationalSchema, /alter table public\.%I enable row level security/i)
  assert.match(
    relationalSchema,
    /create policy nexus_server_access on public\.%I for all to anon using \(private\.nexus_server_request_authorized\(\)\) with check \(private\.nexus_server_request_authorized\(\)\)/i
  )
})
