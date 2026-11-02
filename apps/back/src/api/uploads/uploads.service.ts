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

export type UploadPurpose = 'profile-avatar' | 'community-avatar' | 'editor-image'
export type UploadResourceType = 'profile' | 'community' | 'profile-message'

export type UploadedFileRecord = {
  id: string
  ownerUserId: string
  purpose: UploadPurpose
  bucket: string
  path: string
  contentType: string
  expectedSize: number
  size: number | null
  status: 'pending' | 'ready'
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

    const records = await this.data.read<UploadedFileRecord>('media_files')
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
    await this.data.write('media_files', [...records, record])

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
    if (record.createdAt + PENDING_MAX_AGE <= Date.now()) {
      await this.deleteRecord(record, records)
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
      await this.deleteRecord(record, records)
      throw new BadRequestException('INVALID_UPLOAD_CONTENT')
    }

    const completedAt = Date.now()
    const updated: UploadedFileRecord = {
      ...record,
      size: totalSize,
      status: 'ready',
      completedAt,
      expiresAt: record.purpose === 'editor-image' ? completedAt + EDITOR_RETENTION_MS : null
    }
    await this.data.write('media_files', records.map(item => item.id === id ? updated : item))
    return { id, url: this.getUploadUrl(updated) }
  }

  async deleteUpload(userId: string, id: string): Promise<void> {
    const records = await this.data.read<UploadedFileRecord>('media_files')
    const record = records.find(item => item.id === id && item.ownerUserId === userId)
    if (!record) return
    if (record.resourceType) throw new ForbiddenException('UPLOAD_ALREADY_ATTACHED')
    await this.deleteRecord(record, records)
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

  async attachAvatarUrl(
    userId: string,
    url: string,
    purpose: 'profile-avatar' | 'community-avatar',
    resourceType: 'profile' | 'community',
    resourceId: string
  ): Promise<void> {
    const path = this.getAvatarPath(url)
    if (!path) return
    const records = await this.data.read<UploadedFileRecord>('media_files')
    const record = records.find(item => item.bucket === AVATAR_BUCKET && item.path === path)
    if (!record || record.ownerUserId !== userId || record.purpose !== purpose ||
      record.status !== 'ready' || record.resourceType ||
      (record.completedAt ?? record.createdAt) + ORPHAN_AVATAR_RETENTION_MS <= Date.now()) {
      throw new BadRequestException('INVALID_AVATAR_UPLOAD')
    }
    await this.data.write('media_files', records.map(item => item.id === record.id
      ? { ...item, resourceType, resourceId }
      : item))
  }

  async setProfileAvatar(userId: string, profileId: string, uploadId: string | null): Promise<{ picture: string }> {
    await this.assertOwnsProfile(userId, profileId)
    const profiles = await this.data.read<{ id: string; picture: string }>('profiles')
    const profile = profiles.find(item => item.id === profileId)
    if (!profile) throw new NotFoundException('PROFILE_NOT_FOUND')

    const records = await this.data.read<UploadedFileRecord>('media_files')
    const next = uploadId
      ? this.getReadyAvatar(records, userId, uploadId, 'profile-avatar')
      : null
    const picture = next ? this.publicUrl(next.path) : ''

    await this.data.write('profiles', profiles.map(item =>
      item.id === profileId ? { ...item, picture } : item
    ))
    if (next) {
      await this.data.write('media_files', records.map(item => item.id === next.id
        ? { ...item, resourceType: 'profile', resourceId: profileId }
        : item))
    }
    await this.deletePreviousAvatar(profile.picture, next?.id)
    return { picture }
  }

  async setCommunityAvatar(
    userId: string,
    communityId: string,
    actorProfileId: string,
    uploadId: string | null
  ): Promise<{ picture: string }> {
    await this.assertCommunityStaff(userId, communityId, actorProfileId)
    const communities = await this.data.read<{ id: string; picture: string }>('communities')
    const community = communities.find(item => item.id === communityId)
    if (!community) throw new NotFoundException('COMMUNITY_NOT_FOUND')

    const records = await this.data.read<UploadedFileRecord>('media_files')
    const next = uploadId
      ? this.getReadyAvatar(records, userId, uploadId, 'community-avatar')
      : null
    const picture = next ? this.publicUrl(next.path) : ''

    await this.data.write('communities', communities.map(item =>
      item.id === communityId ? { ...item, picture } : item
    ))
    if (next) {
      await this.data.write('media_files', records.map(item => item.id === next.id
        ? { ...item, resourceType: 'community', resourceId: communityId }
        : item))
    }
    await this.deletePreviousAvatar(community.picture, next?.id)
    return { picture }
  }

  async validateEditorImages(userId: string, html: string): Promise<void> {
    const ids = this.extractEditorImageIds(html)
    if (!ids.length) return
    const records = await this.data.read<UploadedFileRecord>('media_files')
    for (const id of ids) this.getReadyEditorImage(records, userId, id)
  }

  async validateEditorImagesForResource(
    userId: string,
    html: string,
    resourceType: 'profile' | 'community',
    resourceId: string
  ): Promise<void> {
    const ids = this.extractEditorImageIds(html)
    if (!ids.length) return
    const records = await this.data.read<UploadedFileRecord>('media_files')
    for (const id of ids) {
      const record = records.find(item => item.id === id)
      if (!record || record.ownerUserId !== userId || record.purpose !== 'editor-image' ||
        record.status !== 'ready' || (record.expiresAt !== null && record.expiresAt <= Date.now()) ||
        (record.resourceType !== null &&
          (record.resourceType !== resourceType || record.resourceId !== resourceId))) {
        throw new BadRequestException('INVALID_EDITOR_IMAGE')
      }
    }
  }

  async attachEditorImagesForResource(
    userId: string,
    html: string,
    resourceType: 'profile' | 'community',
    resourceId: string
  ): Promise<void> {
    await this.validateEditorImagesForResource(userId, html, resourceType, resourceId)
    const ids = this.extractEditorImageIds(html)
    if (!ids.length) return
    const idSet = new Set(ids)
    const records = await this.data.read<UploadedFileRecord>('media_files')
    await this.data.write('media_files', records.map(item =>
      idSet.has(item.id) && !item.resourceType
        ? { ...item, resourceType, resourceId }
        : item
    ))
  }

  async attachEditorImages(
    userId: string,
    html: string,
    resourceType: UploadResourceType,
    resourceId: string,
    messageParticipants?: { fromProfileId: string; toProfileId: string }
  ): Promise<void> {
    const ids = this.extractEditorImageIds(html)
    if (!ids.length) return
    const records = await this.data.read<UploadedFileRecord>('media_files')
    for (const id of ids) this.getReadyEditorImage(records, userId, id)
    const idSet = new Set(ids)
    await this.data.write('media_files', records.map(item => idSet.has(item.id)
      ? {
          ...item,
          resourceType,
          resourceId,
          messageFromProfileId: messageParticipants?.fromProfileId ?? null,
          messageToProfileId: messageParticipants?.toProfileId ?? null
        }
      : item))
  }

  async cleanupExpired(suppliedSecret: string | undefined): Promise<{ deleted: number }> {
    if (!this.secretsMatch(this.cronSecret, suppliedSecret)) {
      throw new ForbiddenException('CRON_SECRET_INVALID')
    }
    this.assertStorageConfigured()

    const records = await this.data.read<UploadedFileRecord>('media_files')
    const now = Date.now()
    const expired = records.filter(item =>
      (item.purpose === 'editor-image' && item.expiresAt !== null && item.expiresAt <= now) ||
      (item.status === 'pending' && item.createdAt + PENDING_MAX_AGE <= now) ||
      (item.purpose !== 'editor-image' && item.status === 'ready' &&
        !item.resourceType && (item.completedAt ?? item.createdAt) + ORPHAN_AVATAR_RETENTION_MS <= now)
    )
    if (!expired.length) return { deleted: 0 }

    for (const bucket of [AVATAR_BUCKET, EDITOR_BUCKET]) {
      const paths = expired.filter(item => item.bucket === bucket).map(item => item.path)
      if (paths.length) await this.removeObjects(bucket, paths)
    }
    const expiredIds = new Set(expired.map(item => item.id))
    await this.data.write('media_files', records.filter(item => !expiredIds.has(item.id)))
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
      const communities = await this.data.read<{ id: string }>('communities')
      if (communities.some(item => item.id === record.resourceId)) return
      throw new NotFoundException('UPLOAD_NOT_FOUND')
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

  private async assertOwnsProfile(userId: string, profileId: string): Promise<void> {
    if (!await this.auth.ownsProfile(userId, profileId)) {
      throw new ForbiddenException('PROFILE_NOT_OWNED')
    }
  }

  private async assertCommunityStaff(userId: string, communityId: string, actorProfileId: string): Promise<void> {
    await this.assertOwnsProfile(userId, actorProfileId)
    const relationships = await this.data.read<{
      profiles: [string, string]
      type: string
    }>('community_relationships')
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
    const records = await this.data.read<UploadedFileRecord>('media_files')
    const old = records.find(item => item.bucket === AVATAR_BUCKET && item.path === path)
    if (!old || old.id === keepId) return
    await this.removeObjects(AVATAR_BUCKET, [old.path])
    await this.data.write('media_files', records.filter(item => item.id !== old.id))
  }

  private async deleteRecord(record: UploadedFileRecord, records: UploadedFileRecord[]): Promise<void> {
    await this.removeObjects(record.bucket, [record.path])
    await this.data.write('media_files', records.filter(item => item.id !== record.id))
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
