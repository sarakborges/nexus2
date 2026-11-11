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
} from './uploads.constants'
import { detectMime, getTotalSize } from './uploads.utils'
import { UploadsStorageService } from './uploads.storage.service'
import { UploadsCleanupService } from './uploads.cleanup.service'
import { UploadsContentService } from './uploads.content.service'
import { UploadsAvatarService } from './uploads.avatar.service'
import {
  attachEditorImages,
  detachEditorImages,
  detachResourceAttachments,
  getEditorImageIds as extractEditorImageIds
} from './uploads.attachments'
import type {
  CreateUploadInput,
  SignedUploadResponse,
  EditorMessageParticipants,
  UploadResourceReference,
  UploadResourceType,
  UploadedFileRecord
} from './uploads.types'

@Injectable()
export class UploadsService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly storage: UploadsStorageService,
    private readonly cleanup: UploadsCleanupService,
    private readonly content: UploadsContentService,
    private readonly avatars: UploadsAvatarService
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
        this.avatars.assertOwnsProfileInRecords(userId, input.targetId, accounts!, profiles!)
      }
      if (input.purpose === 'community-avatar' && input.targetId && input.actorProfileId) {
        const currentProfiles = profiles as Array<{ id: string; type: string }>
        const communities = collections.communities as Array<{ id: string }>
        const relationships = collections.community_relationships as Array<{
          profiles: [string, string]; type: string
        }>
        this.avatars.assertOwnsProfileInRecords(userId, input.actorProfileId, accounts!, currentProfiles)

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
    const totalSize = getTotalSize(
      response.headers.get('content-range'),
      response.headers.get('content-length'),
      bytes.length
    )
    const detectedMime = detectMime(bytes)
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

  getEditorImageIds(html: string): string[] {
    return extractEditorImageIds(html)
  }

  attachAvatarUrlToRecords(
    records: UploadedFileRecord[],
    userId: string,
    url: string,
    purpose: 'profile-avatar' | 'community-avatar',
    resourceType: 'profile' | 'community',
    resourceId: string
  ): UploadedFileRecord[] {
    return this.avatars.attachAvatarUrlToRecords(
      records, userId, url, purpose, resourceType, resourceId
    )
  }

  attachAvatarRecordToRecords(
    records: UploadedFileRecord[],
    userId: string,
    uploadId: string,
    purpose: 'profile-avatar' | 'community-avatar',
    resourceType: 'profile' | 'community',
    resourceId: string
  ): UploadedFileRecord[] {
    return this.avatars.attachAvatarRecordToRecords(
      records, userId, uploadId, purpose, resourceType, resourceId
    )
  }

  async setProfileAvatar(userId: string, profileId: string, uploadId: string | null): Promise<{ picture: string }> {
    return this.avatars.setProfileAvatar(userId, profileId, uploadId)
  }

  async setCommunityAvatar(
    userId: string,
    communityId: string,
    actorProfileId: string,
    uploadId: string | null
  ): Promise<{ picture: string }> {
    return this.avatars.setCommunityAvatar(userId, communityId, actorProfileId, uploadId)
  }

  attachEditorImagesToRecords(
    records: UploadedFileRecord[],
    userId: string,
    html: string,
    resourceType: UploadResourceType,
    resourceId: string,
    messageParticipants?: EditorMessageParticipants
  ): UploadedFileRecord[] {
    return attachEditorImages(records, userId, html, resourceType, resourceId, messageParticipants)
  }

  detachResourceAttachmentsFromRecords(
    records: UploadedFileRecord[],
    userId: string | null,
    resources: UploadResourceReference[]
  ): UploadedFileRecord[] {
    return detachResourceAttachments(records, userId, resources)
  }

  detachEditorImagesFromRecords(
    records: UploadedFileRecord[],
    html: string,
    resourceType: UploadResourceType,
    resourceId: string
  ): UploadedFileRecord[] {
    return detachEditorImages(records, html, resourceType, resourceId)
  }

  async cleanupExpired(suppliedSecret: string | undefined): Promise<{ deleted: number }> {
    return this.cleanup.cleanupExpired(suppliedSecret)
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
