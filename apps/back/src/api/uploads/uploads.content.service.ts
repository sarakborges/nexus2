import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { AccountRecord } from '../auth/auth.types'
import { UploadsStorageService } from './uploads.storage.service'
import { detectMime } from './uploads.utils'
import type { UploadedFileRecord } from './uploads.types'

@Injectable()
export class UploadsContentService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly storage: UploadsStorageService
  ) {}

  async getEditorImage(userId: string | null, id: string): Promise<{ body: Buffer; contentType: string }> {
    this.storage.assertConfigured()
    if (this.data.getEditorImageRecord) {
      let record: UploadedFileRecord
      try {
        record = await this.data.getEditorImageRecord({ userId, id, now: Date.now() })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (message.includes('UPLOAD_ACCESS_DENIED')) throw new ForbiddenException('UPLOAD_ACCESS_DENIED')
        if (message.includes('ACCOUNT_NOT_FOUND')) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
        if (message.includes('UPLOAD_NOT_FOUND')) throw new NotFoundException('UPLOAD_NOT_FOUND')
        throw error
      }
      return this.downloadEditorImage(record)
    }

    const initialRecords = await this.data.read<UploadedFileRecord>('media_files')    const initialRecords = await this.data.read<UploadedFileRecord>('media_files')
    const locator = initialRecords.find(item =>
      item.id === id && item.purpose === 'editor-image' && item.status === 'ready'
    )
    if (!locator || (locator.expiresAt !== null && locator.expiresAt <= Date.now())) {
      throw new NotFoundException('UPLOAD_NOT_FOUND')
    }

    const resourceType = locator.resourceType
    const resourceId = locator.resourceId
    const collections = ['media_files']
    if (resourceType === 'profile') collections.push('profiles')
    if (resourceType === 'community' ||
        resourceType === 'community-forum-topic' ||
        resourceType === 'community-forum-reply') {
      collections.push('accounts', 'communities', 'community_relationships')
      if (resourceType === 'community-forum-topic') collections.push('community_forum_topics')
      if (resourceType === 'community-forum-reply') collections.push('community_forum_replies')
    }
    if (resourceType === 'profile-message') collections.push('accounts', 'profile_messages')

    const record = await this.data.transaction<UploadedFileRecord>(
      collections,
      current => {
        const latest = (current.media_files as UploadedFileRecord[]).find(item => item.id === id)
        if (
          !latest ||
          latest.purpose !== 'editor-image' ||
          latest.status !== 'ready' ||
          (latest.expiresAt !== null && latest.expiresAt <= Date.now()) ||
          latest.resourceType !== resourceType ||
          latest.resourceId !== resourceId
        ) {
          throw new NotFoundException('UPLOAD_NOT_FOUND')
        }

        if (!latest.resourceType) {
          if (userId !== latest.ownerUserId) throw new ForbiddenException('UPLOAD_ACCESS_DENIED')
          return { records: current, result: latest }
        }

        if (latest.resourceType === 'profile') {
          const profiles = current.profiles as Array<{ id: string }>
          if (!profiles.some(profile => profile.id === latest.resourceId)) {
            throw new NotFoundException('UPLOAD_NOT_FOUND')
          }
          return { records: current, result: latest }
        }

        if (
          latest.resourceType === 'community' ||
          latest.resourceType === 'community-forum-topic' ||
          latest.resourceType === 'community-forum-reply'
        ) {
          let communityId = latest.resourceId!
          if (latest.resourceType === 'community-forum-topic' ||
              latest.resourceType === 'community-forum-reply') {
            const resourceCollection = latest.resourceType === 'community-forum-topic'
              ? current.community_forum_topics as Array<{ id: string; communityId: string }>
              : current.community_forum_replies as Array<{ id: string; communityId: string }>
            const resource = resourceCollection.find(item => item.id === latest.resourceId)
            if (!resource) throw new NotFoundException('UPLOAD_NOT_FOUND')
            communityId = resource.communityId
          }

          const communities = current.communities as Array<{ id: string; privacy?: string }>
          const community = communities.find(item => item.id === communityId)
          if (!community) throw new NotFoundException('UPLOAD_NOT_FOUND')
          if (community.privacy === 'private') {
            if (!userId) throw new NotFoundException('UPLOAD_NOT_FOUND')
            const accounts = current.accounts as AccountRecord[]
            const account = accounts.find(item => item.id === userId)
            if (!account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
            const ownedProfiles = new Set(account.profiles)
            const relationships = current.community_relationships as Array<{
              profiles: [string, string]; type: string
            }>
            const canRead = relationships.some(relationship =>
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
          const accounts = current.accounts as AccountRecord[]
          const account = accounts.find(item => item.id === userId)
          if (!account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
          const messages = current.profile_messages as Array<{
            id: string
            fromProfileId: string
            toProfileId: string
          }>
          const message = messages.find(item => item.id === latest.resourceId)
          if (!message ||
              message.fromProfileId !== latest.messageFromProfileId ||
              message.toProfileId !== latest.messageToProfileId) {
            throw new NotFoundException('UPLOAD_NOT_FOUND')
          }
          const participants = [message.fromProfileId, message.toProfileId]
          if (!account.profiles.some(profileId => participants.includes(profileId))) {
            throw new ForbiddenException('UPLOAD_ACCESS_DENIED')
          }
          return { records: current, result: latest }
        }

        throw new NotFoundException('UPLOAD_NOT_FOUND')
      }
    )

    return this.downloadEditorImage(record)
  }

  private async downloadEditorImage(record: UploadedFileRecord): Promise<{ body: Buffer; contentType: string }> {
    const response = await this.storage.request(
      '/object/' + record.bucket + '/' + this.storage.encodePath(record.path),
      { method: 'GET' }
    )
    if (response.status === 404) throw new NotFoundException('UPLOAD_NOT_FOUND')
    if (!response.ok) throw new ServiceUnavailableException('UPLOAD_STORAGE_REQUEST_FAILED')
    const body = Buffer.from(await response.arrayBuffer())
    if (body.length !== record.size || detectMime(body) !== record.contentType) {
      throw new NotFoundException('UPLOAD_NOT_FOUND')
    }
    return { body, contentType: record.contentType }
  }
}
