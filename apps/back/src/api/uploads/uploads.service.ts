import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { AccountRecord } from '../auth/auth.types'
import {
  AVATAR_BUCKET,
  AVATAR_MAX_SIZE,
  EDITOR_BUCKET,
  EDITOR_MAX_SIZE,
  EDITOR_RETENTION_MS,
  MIME_EXTENSIONS,
  PENDING_MAX_AGE,
  UPLOAD_REFERENCE
} from './uploads.constants'
import { isWithinAvatarDraftRetention } from './uploads.utils'
import { UploadsStorageService } from './uploads.storage.service'
import { UploadsCleanupService } from './uploads.cleanup.service'
import { UploadsContentService } from './uploads.content.service'
import type {
  CreateUploadInput,
  SignedUploadResponse,
  UploadResourceType,
  UploadedFileRecord
} from './uploads.types'

@Injectable()
export class UploadsService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly storage: UploadsStorageService,
    private readonly cleanup: UploadsCleanupService,
    private readonly content: UploadsContentService
  ) {}

  async createUpload(userId: string, input: CreateUploadInput): Promise<{ id: string; uploadUrl: string }> {
    this.storage.assertConfigured()
    const extension = MIME_EXTENSIONS[input.contentType]
    const maxSize = input.purpose === 'editor-image' ? EDITOR_MAX_SIZE : AVATAR_MAX_SIZE
    if (!extension || !Number.isSafeInteger(input.size) || input.size < 1 || input.size > maxSize) {
      throw new BadRequestException('INVALID_UPLOAD')
    }
    if (input.purpose === 'community-avatar' && input.targetId && !input.actorProfileId) {
      throw new ForbiddenException('COMMUNITY_STAFF_REQUIRED')
    }

    const id = randomUUID()
    const bucket = input.purpose === 'editor-image' ? EDITOR_BUCKET : AVATAR_BUCKET
    const folder = input.purpose === 'editor-image'
      ? 'editor/' + userId
      : (input.purpose === 'profile-avatar' ? 'profiles/' : 'communities/') + userId
    const path = folder + '/' + id + '.' + extension
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

    const collectionsToRead = ['media_files']
    if (input.purpose === 'profile-avatar' && input.targetId) {
      collectionsToRead.push('accounts', 'profiles')
    }
    if (input.purpose === 'community-avatar' && input.targetId) {
      collectionsToRead.push('accounts', 'profiles', 'communities', 'community_relationships')
    }
    await this.data.transaction<void>(collectionsToRead, collections => {
      const profiles = collections.profiles as Array<{ id: string; type?: string }> | undefined
      const accounts = collections.accounts as AccountRecord[] | undefined
      if (input.purpose === 'profile-avatar' && input.targetId) {
        this.assertOwnsProfileInRecords(userId, input.targetId, accounts!, profiles!)
      }
      if (input.purpose === 'community-avatar' && input.targetId && input.actorProfileId) {
        const currentProfiles = profiles as Array<{ id: string; type: string }>
        const communities = collections.communities as Array<{ id: string }>
        const relationships = collections.community_relationships as Array<{
          profiles: [string, string]; type: string
        }>
        this.assertOwnsProfileInRecords(userId, input.actorProfileId, accounts!, currentProfiles)

        const actor = currentProfiles.find(item => item.id === input.actorProfileId)
        const community = communities.find(item => item.id === input.targetId)
        const ownerProfileId = relationships.find(item =>
          item.profiles[1] === input.targetId && item.type === 'owner'
        )?.profiles[0]
        const owner = ownerProfileId
          ? currentProfiles.find(item => item.id === ownerProfileId)
          : undefined
        if (!actor || !community || !owner) {
          throw new NotFoundException('COMMUNITY_NOT_FOUND')
        }
        if (actor.type !== owner.type) throw new ForbiddenException('PROFILE_TYPE_MISMATCH')
        const role = relationships.find(item =>
          item.profiles[0] === input.actorProfileId && item.profiles[1] === input.targetId
        )?.type
        if (role !== 'owner' && role !== 'moderator') {
          throw new ForbiddenException('COMMUNITY_STAFF_REQUIRED')
        }
      }
      const mediaFiles = collections.media_files as UploadedFileRecord[]
      return {
        records: { ...collections, media_files: [...mediaFiles, record] },
        result: undefined
      }
    })

    let signedData: SignedUploadResponse
    try {
      const signedResponse = await this.storage.request(
        '/object/upload/sign/' + bucket + '/' + this.storage.encodePath(path),
        { method: 'POST', body: JSON.stringify({}) }
      )
      signedData = await this.storage.readJson<SignedUploadResponse>(signedResponse)
      if (!signedData.url) throw new ServiceUnavailableException('UPLOAD_SIGNING_FAILED')
    } catch (error) {
      try {
        await this.data.update<UploadedFileRecord>('media_files', records =>
          records.filter(item => item.id !== id || item.ownerUserId !== userId || item.status !== 'pending')
        )
      } catch {
        // The pending record will be removed by the normal expiration cleanup.
      }
      throw error
    }

    const uploadUrl = this.storage.resolveUploadUrl(signedData.url)
    return { id, uploadUrl }
  }

  async completeUpload(userId: string, id: string): Promise<{ id: string; url: string }> {
    this.storage.assertConfigured()
    const records = await this.data.read<UploadedFileRecord>('media_files')
    const record = records.find(item => item.id === id && item.ownerUserId === userId)
    if (!record) throw new NotFoundException('UPLOAD_NOT_FOUND')
    if (record.status === 'ready') {
      if (
        record.purpose === 'editor-image' &&
        record.expiresAt !== null &&
        record.expiresAt <= Date.now()
      ) {
        throw new NotFoundException('UPLOAD_EXPIRED')
      }
      return { id, url: this.getUploadUrl(record) }
    }
    if (record.status !== 'pending') throw new NotFoundException('UPLOAD_NOT_FOUND')
    if (record.createdAt + PENDING_MAX_AGE <= Date.now()) {
      await this.cleanup.scheduleUploadDeletion(id, userId)
      throw new NotFoundException('UPLOAD_EXPIRED')
    }

    const response = await this.storage.request(
      '/object/' + record.bucket + '/' + this.storage.encodePath(record.path),
      { method: 'GET', headers: { Range: 'bytes=0-63' } }
    )
    if (response.status === 404) {
      throw new BadRequestException('UPLOAD_NOT_FOUND_IN_STORAGE')
    }
    if (!response.ok) {
      throw new ServiceUnavailableException('UPLOAD_STORAGE_REQUEST_FAILED')
    }

    const bytes = Buffer.from(await response.arrayBuffer())
    const totalSize = this.storage.getTotalSize(
      response.headers.get('content-range'),
      response.headers.get('content-length'),
      bytes.length
    )
    const detectedMime = this.storage.detectMime(bytes)
    const maxSize = record.purpose === 'editor-image' ? EDITOR_MAX_SIZE : AVATAR_MAX_SIZE

    if (
      totalSize < 1 ||
      totalSize > maxSize ||
      totalSize !== record.expectedSize ||
      detectedMime !== record.contentType
    ) {
      await this.cleanup.scheduleUploadDeletion(id, userId)
      throw new BadRequestException('INVALID_UPLOAD_CONTENT')
    }

    const completedAt = Date.now()
    const savedRecords = await this.data.update<UploadedFileRecord>('media_files', currentRecords => {
      const latest = currentRecords.find(item => item.id === id && item.ownerUserId === userId)
      if (!latest) throw new NotFoundException('UPLOAD_NOT_FOUND')
      if (latest.status === 'ready') return currentRecords
      if (latest.status !== 'pending' || latest.createdAt + PENDING_MAX_AGE <= Date.now()) {
        throw new NotFoundException('UPLOAD_EXPIRED')
      }

      const saved: UploadedFileRecord = {
        ...latest,
        size: totalSize,
        status: 'ready',
        deletingAt: null,
        completedAt,
        expiresAt: latest.purpose === 'editor-image' ? completedAt + EDITOR_RETENTION_MS : null
      }
      return currentRecords.map(item => item.id === id ? saved : item)
    })
    const saved = savedRecords.find(item => item.id === id && item.ownerUserId === userId)
    if (!saved) throw new NotFoundException('UPLOAD_NOT_FOUND')
    if (
      saved.purpose === 'editor-image' &&
      saved.expiresAt !== null &&
      saved.expiresAt <= Date.now()
    ) {
      throw new NotFoundException('UPLOAD_EXPIRED')
    }
    return { id, url: this.getUploadUrl(saved) }
  }

  async deleteUpload(userId: string, id: string): Promise<void> {
    await this.cleanup.deleteUpload(userId, id)
  }

  async getEditorImage(userId: string | null, id: string): Promise<{ body: Buffer; contentType: string }> {
    return this.content.getEditorImage(userId, id)
  }

  attachAvatarUrlToRecords(
    records: UploadedFileRecord[],
    userId: string,
    url: string,
    purpose: 'profile-avatar' | 'community-avatar',
    resourceType: 'profile' | 'community',
    resourceId: string
  ): UploadedFileRecord[] {
    const path = this.storage.getAvatarPath(url)
    if (!path) return records
    const record = records.find(item => item.bucket === AVATAR_BUCKET && item.path === path)
    if (!record || record.ownerUserId !== userId || record.purpose !== purpose ||
      record.status !== 'ready' || record.resourceType ||
      !isWithinAvatarDraftRetention(record)) {
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
        const picture = next ? this.storage.publicAvatarUrl(next.path) : ''
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
        const picture = next ? this.storage.publicAvatarUrl(next.path) : ''
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

  async cleanupExpired(suppliedSecret: string | undefined): Promise<{ deleted: number }> {
    return this.cleanup.cleanupExpired(suppliedSecret)
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
      isWithinAvatarDraftRetention(item)
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

  async deletePreviousAvatar(previousUrl: string, keepId?: string): Promise<void> {
    await this.cleanup.deletePreviousAvatar(previousUrl, keepId)
  }

  private getUploadUrl(record: UploadedFileRecord): string {
    return record.purpose === 'editor-image'
      ? '/api/uploads/' + record.id + '/content'
      : this.storage.publicAvatarUrl(record.path)
  }

}
