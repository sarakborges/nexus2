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

    try {
      await this.data.createUpload({
        record,
        targetId: input.targetId ?? null,
        actorProfileId: input.actorProfileId ?? null
      })
    } catch (error) {
      this.throwUploadWriteError(error)
    }

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
        await this.data.deletePendingUpload(userId, id)
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
    const record = await this.data.getUploadById(userId, id)
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
    let saved: UploadedFileRecord
    try {
      saved = await this.data.completeUpload({
        userId,
        id,
        size: totalSize,
        completedAt,
        expiresAt: record.purpose === 'editor-image' ? completedAt + EDITOR_RETENTION_MS : null,
        pendingMaxAge: PENDING_MAX_AGE
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('UPLOAD_EXPIRED')) throw new NotFoundException('UPLOAD_EXPIRED')
      if (message.includes('UPLOAD_NOT_FOUND')) throw new NotFoundException('UPLOAD_NOT_FOUND')
      throw error
    }
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

  getAvatarPath(url: string): string | null {
    return this.storage.getAvatarPath(url)
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

  private throwUploadWriteError(error: unknown): never {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('PROFILE_NOT_OWNED')) throw new ForbiddenException('PROFILE_NOT_OWNED')
    if (message.includes('PROFILE_TYPE_MISMATCH')) throw new ForbiddenException('PROFILE_TYPE_MISMATCH')
    if (message.includes('COMMUNITY_NOT_FOUND')) throw new NotFoundException('COMMUNITY_NOT_FOUND')
    if (message.includes('COMMUNITY_STAFF_REQUIRED')) throw new ForbiddenException('COMMUNITY_STAFF_REQUIRED')
    if (message.includes('ACCOUNT_NOT_FOUND')) throw new NotFoundException('ACCOUNT_NOT_FOUND')
    throw error
  }


}
