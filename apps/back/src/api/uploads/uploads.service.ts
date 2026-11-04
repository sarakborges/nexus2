import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { timingSafeEqual, randomUUID } from 'node:crypto'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import { AuthService } from '../auth/auth.service'
import type { AccountRecord } from '../auth/auth.types'

export type UploadPurpose = 'profile-avatar' | 'community-avatar' | 'editor-image'
export type UploadResourceType = 'profile' | 'community' | 'profile-message' | 'community-forum-topic' | 'community-forum-reply'

export type UploadedFileRecord = {
  id: string
  ownerUserId: string
  purpose: UploadPurpose
  bucket: string
  path: string
  contentType: string
  expectedSize: number
  size: number | null
  status: 'pending' | 'ready' | 'deleting'
  deletingAt?: number | null
  createdAt: number
  completedAt: number | null
  expiresAt: number | null
  resourceType: UploadResourceType | null
  resourceId: string | null
  messageFromProfileId: string | null
  messageToProfileId: string | null
}

export type CreateUploadInput = {
  purpose: UploadPurpose
  contentType: string
  size: number
  targetId?: string
  actorProfileId?: string
}

type SignedUploadResponse = { url?: string }

const AVATAR_BUCKET = 'nexus-avatars'
const EDITOR_BUCKET = 'nexus-editor-images'
const AVATAR_MAX_SIZE = 5 * 1024 * 1024
const EDITOR_MAX_SIZE = 10 * 1024 * 1024
const PENDING_MAX_AGE = 2 * 60 * 60 * 1000
const EDITOR_RETENTION_MS = 24 * 60 * 60 * 1000
const ORPHAN_AVATAR_RETENTION_MS = 24 * 60 * 60 * 1000
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif'
}
const UPLOAD_REFERENCE = /<img\b[^>]*\bsrc=(["'])\/api\/uploads\/([0-9a-f-]{36})\/content\1/gi

@Injectable()
export class UploadsService {
  private readonly supabaseUrl: string
  private readonly storageSecret: string
  private readonly cronSecret: string

  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly auth: AuthService,
    private readonly config: ConfigService
  ) {
    this.supabaseUrl = (config.get<string>('SUPABASE_URL') ?? '').replace(/\/+$/, '')
    this.storageSecret = config.get<string>('SUPABASE_STORAGE_SECRET_KEY') ?? ''
    this.cronSecret = config.get<string>('CRON_SECRET') ?? ''
  }

  async createUpload(userId: string, input: CreateUploadInput): Promise<{ id: string; uploadUrl: string }> {
    this.assertStorageConfigured()
    const extension = MIME_EXTENSIONS[input.contentType]
    const maxSize = input.purpose === 'editor-image' ? EDITOR_MAX_SIZE : AVATAR_MAX_SIZE
    if (!extension || !Number.isSafeInteger(input.size) || input.size < 1 || input.size > maxSize) {
      throw new BadRequestException('INVALID_UPLOAD')
    }

    if (input.purpose === 'profile-avatar' && input.targetId) {
      await this.assertOwnsProfile(userId, input.targetId)
    }
    if (input.purpose === 'community-avatar' && input.targetId) {
      if (!input.actorProfileId) throw new ForbiddenException('COMMUNITY_STAFF_REQUIRED')
      await this.assertCommunityStaff(userId, input.targetId, input.actorProfileId)
    }

    const id = randomUUID()
    const bucket = input.purpose === 'editor-image' ? EDITOR_BUCKET : AVATAR_BUCKET
    const folder = input.purpose === 'editor-image'
      ? 'editor/' + userId
      : (input.purpose === 'profile-avatar' ? 'profiles/' : 'communities/') + userId
    const path = folder + '/' + id + '.' + extension
    const encodedPath = this.encodePath(path)

    const signedResponse = await this.storageRequest(
      '/object/upload/sign/' + bucket + '/' + encodedPath,
      { method: 'POST', body: JSON.stringify({}) }
    )
    const signedData = await this.readJson<SignedUploadResponse>(signedResponse)
    if (!signedData.url) throw new ServiceUnavailableException('UPLOAD_SIGNING_FAILED')

    const record: UploadedFileRecord = {
      id,
      ownerUserId: userId,
      purpose: input.purpose,
      bucket,
      path,
      contentType: input.contentType,
      expectedSize: input.size,
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
    await this.data.update<UploadedFileRecord>('media_files', records => [...records, record])

    const uploadUrl = signedData.url.startsWith('http')
      ? signedData.url
      : this.supabaseUrl + '/storage/v1' + signedData.url
    return { id, uploadUrl }
  }

  async completeUpload(userId: string, id: string): Promise<{ id: string; url: string }> {
    this.assertStorageConfigured()
    const records = await this.data.read<UploadedFileRecord>('media_files')
    const record = records.find(item => item.id === id && item.ownerUserId === userId)
    if (!record) throw new NotFoundException('UPLOAD_NOT_FOUND')
    if (record.status === 'ready') return { id, url: this.getUploadUrl(record) }
    if (record.status !== 'pending') throw new NotFoundException('UPLOAD_NOT_FOUND')
    if (record.createdAt + PENDING_MAX_AGE <= Date.now()) {
      await this.deleteRecord(record)
      throw new NotFoundException('UPLOAD_EXPIRED')
    }

    const response = await this.storageRequest(
      '/object/' + record.bucket + '/' + this.encodePath(record.path),
      { method: 'GET', headers: { Range: 'bytes=0-63' } }
    )
    if (!response.ok) throw new BadRequestException('UPLOAD_NOT_FOUND_IN_STORAGE')

    const bytes = Buffer.from(await response.arrayBuffer())
    const totalSize = this.getTotalSize(
      response.headers.get('content-range'),
      response.headers.get('content-length'),
      bytes.length
    )
    const detectedMime = this.detectMime(bytes)
    const maxSize = record.purpose === 'editor-image' ? EDITOR_MAX_SIZE : AVATAR_MAX_SIZE

    if (
      totalSize < 1 ||
      totalSize > maxSize ||
      totalSize !== record.expectedSize ||
      detectedMime !== record.contentType
    ) {
      await this.deleteRecord(record)
      throw new BadRequestException('INVALID_UPLOAD_CONTENT')
    }

    const completedAt = Date.now()
    let saved: UploadedFileRecord | undefined
    await this.data.update<UploadedFileRecord>('media_files', currentRecords => {
      const latest = currentRecords.find(item => item.id === id && item.ownerUserId === userId)
      if (!latest) throw new NotFoundException('UPLOAD_NOT_FOUND')
      if (latest.status === 'ready') {
        saved = latest
        return currentRecords
      }
      if (latest.status !== 'pending' || latest.createdAt + PENDING_MAX_AGE <= Date.now()) {
        throw new NotFoundException('UPLOAD_EXPIRED')
      }

      saved = {
        ...latest,
        size: totalSize,
        status: 'ready',
        deletingAt: null,
        completedAt,
        expiresAt: latest.purpose === 'editor-image' ? completedAt + EDITOR_RETENTION_MS : null
      }
      return currentRecords.map(item => item.id === id ? saved! : item)
    })
    return { id, url: this.getUploadUrl(saved!) }
  }

  async deleteUpload(userId: string, id: string): Promise<void> {
    const records = await this.data.read<UploadedFileRecord>('media_files')
    const record = records.find(item => item.id === id && item.ownerUserId === userId)
    if (!record || record.status === 'deleting') return
    if (record.resourceType) throw new ForbiddenException('UPLOAD_ALREADY_ATTACHED')
    await this.deleteRecord(record)
  }

  async getEditorImage(userId: string | null, id: string): Promise<{ body: Buffer; contentType: string }> {
    this.assertStorageConfigured()
    const records = await this.data.read<UploadedFileRecord>('media_files')
    const record = records.find(item =>
      item.id === id && item.purpose === 'editor-image' && item.status === 'ready'
    )
    if (!record || (record.expiresAt !== null && record.expiresAt <= Date.now())) {
      throw new NotFoundException('UPLOAD_NOT_FOUND')
    }
    await this.assertCanReadEditorImage(userId, record)

    const response = await this.storageRequest(
      '/object/' + record.bucket + '/' + this.encodePath(record.path),
      { method: 'GET' }
    )
    if (!response.ok) throw new NotFoundException('UPLOAD_NOT_FOUND')
    const body = Buffer.from(await response.arrayBuffer())
    if (body.length !== record.size || this.detectMime(body) !== record.contentType) {
      throw new NotFoundException('UPLOAD_NOT_FOUND')
    }
    return { body, contentType: record.contentType }
  }

  async validateAvatarUrl(
    userId: string,
    url: string,
    purpose: 'profile-avatar' | 'community-avatar'
  ): Promise<void> {
    const path = this.getAvatarPath(url)
    if (!path) return
    const records = await this.data.read<UploadedFileRecord>('media_files')
    const record = records.find(item => item.bucket === AVATAR_BUCKET && item.path === path)
    if (!record || record.ownerUserId !== userId || record.purpose !== purpose ||
      record.status !== 'ready' || record.resourceType ||
      record.createdAt + ORPHAN_AVATAR_RETENTION_MS <= Date.now()) {
      throw new BadRequestException('INVALID_AVATAR_UPLOAD')
    }
  }

  attachAvatarUrlToRecords(
    records: UploadedFileRecord[],
    userId: string,
    url: string,
    purpose: 'profile-avatar' | 'community-avatar',
    resourceType: 'profile' | 'community',
    resourceId: string
  ): UploadedFileRecord[] {
    const path = this.getAvatarPath(url)
    if (!path) return records
    const record = records.find(item => item.bucket === AVATAR_BUCKET && item.path === path)
    if (!record || record.ownerUserId !== userId || record.purpose !== purpose ||
      record.status !== 'ready' || record.resourceType ||
      (record.completedAt ?? record.createdAt) + ORPHAN_AVATAR_RETENTION_MS <= Date.now()) {
      throw new BadRequestException('INVALID_AVATAR_UPLOAD')
    }
    return records.map(item => item.id === record.id ? { ...item, resourceType, resourceId } : item)
  }

  attachAvatarRecordToRecords(
    records: UploadedFileRecord[],
    userId: string,
    uploadId: string,
    purpose: 'profile-avatar' | 'community-avatar',
    resourceType: 'profile' | 'community',
    resourceId: string
  ): UploadedFileRecord[] {
    const record = this.getReadyAvatar(records, userId, uploadId, purpose)
    return records.map(item => item.id === record.id ? { ...item, resourceType, resourceId } : item)
  }

  async attachAvatarUrl(
    userId: string,
    url: string,
    purpose: 'profile-avatar' | 'community-avatar',
    resourceType: 'profile' | 'community',
    resourceId: string
  ): Promise<void> {
    await this.data.update<UploadedFileRecord>('media_files', records =>
      this.attachAvatarUrlToRecords(records, userId, url, purpose, resourceType, resourceId)
    )
  }

  async setProfileAvatar(userId: string, profileId: string, uploadId: string | null): Promise<{ picture: string }> {
    const result = await this.data.transaction<{ picture: string; previousPicture: string }>(
      ['accounts', 'profiles', 'media_files'],
      collections => {
        const accounts = collections.accounts as AccountRecord[]
        const profiles = collections.profiles as Array<{ id: string; picture: string; type?: string }>
        const records = collections.media_files as UploadedFileRecord[]
        this.assertOwnsProfileInRecords(userId, profileId, accounts, profiles)

        const profile = profiles.find(item => item.id === profileId)
        if (!profile) throw new NotFoundException('PROFILE_NOT_FOUND')

        const next = uploadId
          ? this.getReadyAvatar(records, userId, uploadId, 'profile-avatar')
          : null
        const picture = next ? this.publicUrl(next.path) : ''
        const nextRecords = next
          ? records.map(item => item.id === next.id
            ? { ...item, resourceType: 'profile' as const, resourceId: profileId }
            : item)
          : records

        return {
          records: {
            ...collections,
            profiles: profiles.map(item => item.id === profileId ? { ...item, picture } : item),
            media_files: nextRecords
          },
          result: { picture, previousPicture: profile.picture }
        }
      }
    )

    await this.deletePreviousAvatar(result.previousPicture, uploadId ?? undefined)
    return { picture: result.picture }
  }

  async setCommunityAvatar(
    userId: string,
    communityId: string,
    actorProfileId: string,
    uploadId: string | null
  ): Promise<{ picture: string }> {
    const result = await this.data.transaction<{ picture: string; previousPicture: string }>(
      ['accounts', 'profiles', 'communities', 'community_relationships', 'media_files'],
      collections => {
        const accounts = collections.accounts as AccountRecord[]
        const profiles = collections.profiles as Array<{ id: string; type?: string }>
        const communities = collections.communities as Array<{ id: string; picture: string; type?: string }>
        const relationships = collections.community_relationships as Array<{
          profiles: [string, string]; type: string
        }>
        const records = collections.media_files as UploadedFileRecord[]
        this.assertOwnsProfileInRecords(userId, actorProfileId, accounts, profiles)

        const actor = profiles.find(item => item.id === actorProfileId)
        const community = communities.find(item => item.id === communityId)
        const ownerProfileId = relationships.find(item =>
          item.profiles[1] === communityId && item.type === 'owner'
        )?.profiles[0]
        const owner = ownerProfileId
          ? profiles.find(item => item.id === ownerProfileId)
          : undefined
        if (!actor || !community || !owner) {
          throw new NotFoundException('COMMUNITY_NOT_FOUND')
        }
        if (actor.type !== owner.type) throw new ForbiddenException('PROFILE_TYPE_MISMATCH')
        const role = relationships.find(item =>
          item.profiles[0] === actorProfileId && item.profiles[1] === communityId
        )?.type
        if (role !== 'owner' && role !== 'moderator') {
          throw new ForbiddenException('COMMUNITY_STAFF_REQUIRED')
        }

        const next = uploadId
          ? this.getReadyAvatar(records, userId, uploadId, 'community-avatar')
          : null
        const picture = next ? this.publicUrl(next.path) : ''
        const nextRecords = next
          ? records.map(item => item.id === next.id
            ? { ...item, resourceType: 'community' as const, resourceId: communityId }
            : item)
          : records

        return {
          records: {
            ...collections,
            communities: communities.map(item => item.id === communityId ? { ...item, picture } : item),
            media_files: nextRecords
          },
          result: { picture, previousPicture: community.picture }
        }
      }
    )

    await this.deletePreviousAvatar(result.previousPicture, uploadId ?? undefined)
    return { picture: result.picture }
  }

  async validateEditorImages(userId: string, html: string): Promise<void> {
    const ids = this.extractEditorImageIds(html)
    if (!ids.length) return
    const records = await this.data.read<UploadedFileRecord>('media_files')
    for (const id of ids) this.getReadyEditorImage(records, userId, id)
  }

  attachEditorImagesToRecords(
    records: UploadedFileRecord[],
    userId: string,
    html: string,
    resourceType: UploadResourceType,
    resourceId: string,
    messageParticipants?: { fromProfileId: string; toProfileId: string }
  ): UploadedFileRecord[] {
    const ids = this.extractEditorImageIds(html)
    if (!ids.length) return records
    const idSet = new Set(ids)
    for (const id of ids) this.getReadyEditorImage(records, userId, id)
    return records.map(item => idSet.has(item.id)
      ? {
          ...item,
          resourceType,
          resourceId,
          messageFromProfileId: messageParticipants?.fromProfileId ?? null,
          messageToProfileId: messageParticipants?.toProfileId ?? null
        }
      : item)
  }

  detachResourceAttachmentsFromRecords(
    records: UploadedFileRecord[],
    userId: string | null,
    resources: Array<{ resourceType: UploadResourceType; resourceId: string }>
  ): UploadedFileRecord[] {
    if (!resources.length) return records
    const resourceKeys = new Set(resources.map(resource =>
      JSON.stringify([resource.resourceType, resource.resourceId])
    ))
    return records.map(item =>
      (!userId || item.ownerUserId === userId) &&
      resourceKeys.has(JSON.stringify([item.resourceType, item.resourceId]))
        ? { ...item, resourceType: null, resourceId: null, messageFromProfileId: null, messageToProfileId: null }
        : item
    )
  }

  async attachEditorImages(
    userId: string,
    html: string,
    resourceType: UploadResourceType,
    resourceId: string,
    messageParticipants?: { fromProfileId: string; toProfileId: string }
  ): Promise<void> {
    await this.data.update<UploadedFileRecord>('media_files', records =>
      this.attachEditorImagesToRecords(records, userId, html, resourceType, resourceId, messageParticipants)
    )
  }

  async detachResourceAttachments(
    userId: string | null,
    resourceType: UploadResourceType,
    resourceId: string
  ): Promise<void> {
    await this.data.update<UploadedFileRecord>('media_files', records =>
      this.detachResourceAttachmentsFromRecords(records, userId, [{ resourceType, resourceId }])
    )
  }

  async cleanupExpired(suppliedSecret: string | undefined): Promise<{ deleted: number }> {
    if (!this.secretsMatch(this.cronSecret, suppliedSecret)) {
      throw new ForbiddenException('CRON_SECRET_INVALID')
    }
    this.assertStorageConfigured()

    const now = Date.now()
    let expired: UploadedFileRecord[] = []
    let expiredIds = new Set<string>()
    await this.data.update<UploadedFileRecord>('media_files', currentRecords => {
      expired = currentRecords.filter(item =>
        (item.status === 'deleting' && (item.deletingAt ?? 0) <= now - 5 * 60 * 1000) ||
        (item.purpose === 'editor-image' && item.status === 'ready' && item.expiresAt !== null && item.expiresAt <= now) ||
        (item.status === 'pending' && item.createdAt + PENDING_MAX_AGE <= now) ||
        (item.purpose !== 'editor-image' && item.status === 'ready' &&
          !item.resourceType && (item.completedAt ?? item.createdAt) + ORPHAN_AVATAR_RETENTION_MS <= now)
      )
      if (!expired.length) return currentRecords
      expiredIds = new Set(expired.map(item => item.id))
      return currentRecords.map(item => expiredIds.has(item.id)
        ? { ...item, status: 'deleting', deletingAt: now }
        : item)
    })
    if (!expired.length) return { deleted: 0 }

    for (const bucket of [AVATAR_BUCKET, EDITOR_BUCKET]) {
      const paths = expired.filter(item => item.bucket === bucket).map(item => item.path)
      if (paths.length) await this.removeObjects(bucket, paths)
    }

    await this.data.update<UploadedFileRecord>('media_files', currentRecords =>
      currentRecords.filter(item => !expiredIds.has(item.id) || item.status !== 'deleting')
    )
    return { deleted: expired.length }
  }

  private async assertCanReadEditorImage(userId: string | null, record: UploadedFileRecord): Promise<void> {
    if (!record.resourceType) {
      if (userId === record.ownerUserId) return
      throw new ForbiddenException('UPLOAD_ACCESS_DENIED')
    }
    if (record.resourceType === 'profile') {
      const profiles = await this.data.read<{ id: string }>('profiles')
      if (profiles.some(item => item.id === record.resourceId)) return
      throw new NotFoundException('UPLOAD_NOT_FOUND')
    }
    if (record.resourceType === 'community') {
      await this.assertCanReadCommunityResource(userId, record.resourceId!)
      return
    }
    if (record.resourceType === 'community-forum-topic' || record.resourceType === 'community-forum-reply') {
      const collection = record.resourceType === 'community-forum-topic'
        ? 'community_forum_topics'
        : 'community_forum_replies'
      const resources = await this.data.read<{ id: string; communityId: string }>(collection)
      const resource = resources.find(item => item.id === record.resourceId)
      if (!resource) throw new NotFoundException('UPLOAD_NOT_FOUND')
      await this.assertCanReadCommunityResource(userId, resource.communityId)
      return
    }

    if (!userId) throw new ForbiddenException('UPLOAD_ACCESS_DENIED')
    const user = await this.auth.getUser(userId)
    const messages = await this.data.read<{
      id: string
      fromProfileId: string
      toProfileId: string
    }>('profile_messages')
    const message = messages.find(item => item.id === record.resourceId)
    if (!message ||
      message.fromProfileId !== record.messageFromProfileId ||
      message.toProfileId !== record.messageToProfileId) {
      throw new NotFoundException('UPLOAD_NOT_FOUND')
    }
    const participants = [message.fromProfileId, message.toProfileId]
    if (!user.profiles.some(profileId => participants.includes(profileId))) {
      throw new ForbiddenException('UPLOAD_ACCESS_DENIED')
    }
  }

  private async assertCanReadCommunityResource(userId: string | null, communityId: string): Promise<void> {
    const communities = await this.data.read<{ id: string; privacy?: string }>('communities')
    const community = communities.find(item => item.id === communityId)
    if (!community) throw new NotFoundException('UPLOAD_NOT_FOUND')
    if (community.privacy !== 'private') return
    if (!userId) throw new NotFoundException('UPLOAD_NOT_FOUND')

    const [user, relationships] = await Promise.all([
      this.auth.getUser(userId),
      this.data.read<{ profiles: [string, string]; type: string }>('community_relationships')
    ])
    const canRead = relationships.some(record =>
      record.profiles[1] === communityId &&
      user.profiles.includes(record.profiles[0]) &&
      ['owner', 'moderator', 'connection'].includes(record.type)
    )
    if (!canRead) throw new NotFoundException('UPLOAD_NOT_FOUND')
  }

  private assertOwnsProfileInRecords(
    userId: string,
    profileId: string,
    accounts: readonly AccountRecord[],
    profiles: readonly { id: string; type?: string }[]
  ): void {
    const account = accounts.find(item => item.id === userId)
    if (!account || !account.profiles.includes(profileId)) {
      throw new ForbiddenException('PROFILE_NOT_OWNED')
    }
    if (!account.currentProfile) return
    const currentProfile = profiles.find(profile => profile.id === account.currentProfile)
    const targetProfile = profiles.find(profile => profile.id === profileId)
    if (
      currentProfile?.type &&
      targetProfile?.type &&
      currentProfile.type !== targetProfile.type
    ) {
      throw new ForbiddenException('PROFILE_TYPE_MISMATCH')
    }
  }

  private async assertOwnsProfile(userId: string, profileId: string): Promise<void> {
    if (!await this.auth.ownsProfile(userId, profileId)) {
      throw new ForbiddenException('PROFILE_NOT_OWNED')
    }
    const user = await this.auth.getUser(userId)
    if (!user.currentProfile) return
    const profiles = await this.data.read<{ id: string; type: string }>('profiles')
    const currentProfile = profiles.find(profile => profile.id === user.currentProfile)
    const targetProfile = profiles.find(profile => profile.id === profileId)
    if (currentProfile && targetProfile && currentProfile.type !== targetProfile.type) {
      throw new ForbiddenException('PROFILE_TYPE_MISMATCH')
    }
  }

  private async assertCommunityStaff(userId: string, communityId: string, actorProfileId: string): Promise<void> {
    await this.assertOwnsProfile(userId, actorProfileId)
    const [relationships, profiles, communities] = await Promise.all([
      this.data.read<{ profiles: [string, string]; type: string }>('community_relationships'),
      this.data.read<{ id: string; type: string }>('profiles'),
      this.data.read<{ id: string }>('communities')
    ])
    const actor = profiles.find(item => item.id === actorProfileId)
    const community = communities.find(item => item.id === communityId)
    const ownerProfileId = relationships.find(item => item.profiles[1] === communityId && item.type === 'owner')?.profiles[0]
    const owner = ownerProfileId ? profiles.find(item => item.id === ownerProfileId) : undefined
    if (!actor || !community || !owner) throw new NotFoundException('COMMUNITY_NOT_FOUND')
    if (actor.type !== owner.type) throw new ForbiddenException('PROFILE_TYPE_MISMATCH')
    const role = relationships.find(item =>
      item.profiles[0] === actorProfileId && item.profiles[1] === communityId
    )?.type
    if (role !== 'owner' && role !== 'moderator') {
      throw new ForbiddenException('COMMUNITY_STAFF_REQUIRED')
    }
  }

  private getReadyAvatar(
    records: UploadedFileRecord[],
    userId: string,
    id: string,
    purpose: 'profile-avatar' | 'community-avatar'
  ): UploadedFileRecord {
    const file = records.find(item =>
      item.id === id &&
      item.ownerUserId === userId &&
      item.purpose === purpose &&
      item.status === 'ready' &&
      !item.resourceType &&
      item.createdAt + ORPHAN_AVATAR_RETENTION_MS > Date.now()
    )
    if (!file) throw new BadRequestException('INVALID_AVATAR_UPLOAD')
    return file
  }

  private getReadyEditorImage(records: UploadedFileRecord[], userId: string, id: string): UploadedFileRecord {
    const file = records.find(item =>
      item.id === id &&
      item.ownerUserId === userId &&
      item.purpose === 'editor-image' &&
      item.status === 'ready'
    )
    if (!file || (file.expiresAt !== null && file.expiresAt <= Date.now())) {
      throw new BadRequestException('INVALID_EDITOR_IMAGE')
    }
    if (file.resourceType) throw new BadRequestException('EDITOR_IMAGE_ALREADY_ATTACHED')
    return file
  }

  private extractEditorImageIds(html: string): string[] {
    return [...html.matchAll(UPLOAD_REFERENCE)]
      .map(match => match[2])
      .filter((id, index, ids) => ids.indexOf(id) === index)
  }

  private async deletePreviousAvatar(previousUrl: string, keepId?: string): Promise<void> {
    const path = this.getAvatarPath(previousUrl)
    if (!path) return
    let old: UploadedFileRecord | undefined
    await this.data.update<UploadedFileRecord>('media_files', current => {
      const latest = current.find(item => item.bucket === AVATAR_BUCKET && item.path === path)
      if (!latest || latest.id === keepId || latest.status === 'deleting') return current
      old = { ...latest, status: 'deleting', deletingAt: Date.now() }
      return current.map(item => item.id === latest.id ? old! : item)
    })
    if (!old) return
    await this.removeObjects(AVATAR_BUCKET, [old.path])
    await this.data.update<UploadedFileRecord>('media_files', current =>
      current.filter(item => item.id !== old!.id)
    )
  }

  private async deleteRecord(record: UploadedFileRecord): Promise<void> {
    let deleting: UploadedFileRecord | undefined
    await this.data.update<UploadedFileRecord>('media_files', current => {
      const latest = current.find(item => item.id === record.id)
      if (!latest || latest.status === 'deleting') return current
      if (latest.resourceType) throw new ForbiddenException('UPLOAD_ALREADY_ATTACHED')
      deleting = { ...latest, status: 'deleting', deletingAt: Date.now() }
      return current.map(item => item.id === latest.id ? deleting! : item)
    })
    if (!deleting) return
    await this.removeObjects(deleting.bucket, [deleting.path])
    await this.data.update<UploadedFileRecord>('media_files', current =>
      current.filter(item => item.id !== deleting!.id)
    )
  }

  private async removeObjects(bucket: string, paths: string[]): Promise<void> {
    const response = await this.storageRequest('/object/' + bucket, {
      method: 'DELETE',
      body: JSON.stringify({ prefixes: paths })
    })
    if (!response.ok) throw new ServiceUnavailableException('UPLOAD_DELETE_FAILED')
  }

  private getUploadUrl(record: UploadedFileRecord): string {
    return record.purpose === 'editor-image'
      ? '/api/uploads/' + record.id + '/content'
      : this.publicUrl(record.path)
  }

  private publicUrl(path: string): string {
    return this.supabaseUrl + '/storage/v1/object/public/' +
      AVATAR_BUCKET + '/' + this.encodePath(path)
  }

  private getAvatarPath(url: string): string | null {
    if (!url) return null
    const prefix = this.supabaseUrl + '/storage/v1/object/public/' + AVATAR_BUCKET + '/'
    if (!url.startsWith(prefix)) return null
    try {
      return url.slice(prefix.length).split('/').map(segment => decodeURIComponent(segment)).join('/')
    } catch {
      throw new BadRequestException('INVALID_AVATAR_URL')
    }
  }

  private getTotalSize(contentRange: string | null, contentLength: string | null, bodySize: number): number {
    const total = contentRange?.split('/').pop()
    const parsedTotal = total ? Number(total) : Number(contentLength)
    return Number.isSafeInteger(parsedTotal) && parsedTotal > 0 ? parsedTotal : bodySize
  }

  private detectMime(bytes: Buffer): string | null {
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
    if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png'
    const prefix = bytes.subarray(0, 6).toString('ascii')
    if (prefix === 'GIF87a' || prefix === 'GIF89a') return 'image/gif'
    if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
      bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
    if (bytes.length >= 12 && bytes.subarray(4, 12).toString('ascii').startsWith('ftypavif')) return 'image/avif'
    return null
  }

  private encodePath(path: string): string {
    return path.split('/').map(segment => encodeURIComponent(segment)).join('/')
  }

  private async storageRequest(path: string, init: RequestInit): Promise<Response> {
    this.assertStorageConfigured()
    const headers = new Headers(init.headers)
    headers.set('apikey', this.storageSecret)
    headers.delete('authorization')
    if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
    return fetch(this.supabaseUrl + '/storage/v1' + path, { ...init, headers })
  }

  private async readJson<T>(response: Response): Promise<T> {
    if (!response.ok) throw new ServiceUnavailableException('UPLOAD_STORAGE_REQUEST_FAILED')
    return await response.json() as T
  }

  private assertStorageConfigured(): void {
    if (!this.supabaseUrl || !this.storageSecret) {
      throw new ServiceUnavailableException('UPLOAD_STORAGE_NOT_CONFIGURED')
    }
  }

  private secretsMatch(expected: string, actual?: string): boolean {
    if (!expected || !actual) return false
    const left = Buffer.from(expected)
    const right = Buffer.from(actual)
    return left.length === right.length && timingSafeEqual(left, right)
  }
}
