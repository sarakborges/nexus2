import { ConflictException, Inject, Injectable, Optional, UnauthorizedException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { PaginatedResult, Profile, ProfileMessage } from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import { paginate } from '../pagination/pagination.helper'
import type { PaginationDto } from '../pagination/pagination.dto'
import { getRichTextPlainText, sanitizeRichText } from './rich-text-sanitizer'
import { UploadsService } from '../uploads/uploads.service'
import type { UploadedFileRecord } from '../uploads/uploads.types'
import { DomainAccessService } from './domain-access.service'
import type { AccountRecord } from '../auth/auth.types'

@Injectable()
export class ProfileMessageService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly access: DomainAccessService,
    @Optional() private readonly uploads?: UploadsService
  ) {}

  async getMessages(profileId: string, userId: string | null, q: PaginationDto): Promise<PaginatedResult<ProfileMessage>> {
    return this.data.transaction<PaginatedResult<ProfileMessage>>(
      ['accounts', 'profile_messages'],
      collections => {
        const account = userId
          ? (collections.accounts as AccountRecord[]).find(item => item.id === userId)
          : undefined
        if (userId && !account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
        const viewerProfiles = account?.profiles ?? []
        const own = viewerProfiles.includes(profileId)
        const visible = (collections.profile_messages as ProfileMessage[])
          .filter(message =>
            message.toProfileId === profileId &&
            (own || viewerProfiles.includes(message.fromProfileId))
          )
          .map(message => ({
            ...message,
            content: sanitizeRichText(message.content ?? '')
          }))
          .sort((a, b) => b.createdAt - a.createdAt)
        return { records: collections, result: paginate(visible, q) }
      }
    )
  }
  async sendMessage(userId: string, fromProfileId: string, toProfileId: string, content: string): Promise<ProfileMessage> {
    const normalized = sanitizeRichText(content)
    const plainText = getRichTextPlainText(normalized)
    const hasImage = /<img\b/i.test(normalized)
    const message: ProfileMessage = {
      id: randomUUID(),
      fromProfileId,
      toProfileId,
      content: normalized,
      createdAt: Date.now()
    }

    return this.data.transaction<ProfileMessage>(
      ['accounts', 'profiles', 'profile_messages', 'media_files'],
      collections => {
        const accounts = collections.accounts as AccountRecord[]
        const profiles = collections.profiles as Profile[]
        const messages = collections.profile_messages as ProfileMessage[]
        const mediaFiles = collections.media_files as UploadedFileRecord[]
        this.access.assertOwnsInRecords(userId, fromProfileId, accounts, profiles)
        this.access.assertSameType(
          profiles.find(profile => profile.id === fromProfileId),
          profiles.find(profile => profile.id === toProfileId)
        )
        const nextMediaFiles = this.uploads
          ? this.uploads.attachEditorImagesToRecords(
              mediaFiles,
              userId,
              normalized,
              'profile-message',
              message.id,
              { fromProfileId, toProfileId }
            )
          : mediaFiles

        if ((!plainText && !hasImage) || plainText.length > 4000 || normalized.length > 12000) {
          throw new ConflictException('INVALID_MESSAGE')
        }
        return {
          records: {
            ...collections,
            profile_messages: [...messages, message],
            media_files: nextMediaFiles
          },
          result: message
        }
      }
    )
  }
}
