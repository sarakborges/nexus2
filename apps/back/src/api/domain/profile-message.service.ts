import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, Optional, UnauthorizedException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { PaginatedResult, Profile, ProfileMessage, Relationship, ProfileSettings } from '@nexus/common'
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
      createdAt: Date.now(),
      isFavorite: false
    }

    return this.data.transaction<ProfileMessage>(
      ['accounts', 'profiles', 'profile_messages', 'media_files', 'relationships', 'profile_settings'],
      collections => {
        const accounts = collections.accounts as AccountRecord[]
        const profiles = collections.profiles as Profile[]
        const messages = collections.profile_messages as ProfileMessage[]
        const mediaFiles = collections.media_files as UploadedFileRecord[]
        this.access.assertOwnsInRecords(userId, fromProfileId, accounts, profiles)
        const recipientSettings = ((collections.profile_settings as Array<ProfileSettings & { profileId: string }> | undefined) ?? [])
          .find(item => item.profileId === toProfileId)
        const messageAudience = recipientSettings?.messageAudience ?? 'everyone'
        if (messageAudience === 'friends') {
          const senderAccount = accounts.find(item => item.id === userId)
          const isSameOwner = senderAccount?.profiles.includes(toProfileId) ?? false
          const isFriend = (collections.relationships as Relationship[]).some(relationship =>
            relationship.type === 'connection' &&
            relationship.profiles.includes(fromProfileId) &&
            relationship.profiles.includes(toProfileId)
          )
          if (!isSameOwner && !isFriend) throw new ForbiddenException('PROFILE_MESSAGE_FRIENDS_ONLY')
        }
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

        if ((!plainText && !hasImage) || normalized.length > 8000) {
          throw new ConflictException('INVALID_MESSAGE')
        }
        return {
          records: {
            ...collections,
            profiles: this.access.touchProfilesActivity(profiles, [fromProfileId, toProfileId], message.createdAt),
            profile_messages: [...messages, message],
            media_files: nextMediaFiles
          },
          result: message
        }
      }
    )
  }

  async deleteMessage(userId: string, recipientProfileId: string, messageId: string, actorProfileId: string): Promise<void> {
    await this.data.transaction(['accounts', 'profile_messages', 'media_files'], collections => {
      const account = (collections.accounts as AccountRecord[]).find(item => item.id === userId)
      if (!account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
      const messages = collections.profile_messages as ProfileMessage[]
      const message = messages.find(item => item.id === messageId && item.toProfileId === recipientProfileId)
      if (!message) throw new NotFoundException('PROFILE_MESSAGE_NOT_FOUND')
      if (!account.profiles.includes(actorProfileId)) throw new ForbiddenException('PROFILE_NOT_OWNED')
      if (actorProfileId !== message.fromProfileId && actorProfileId !== message.toProfileId) {
        throw new ForbiddenException('PROFILE_MESSAGE_DELETE_NOT_ALLOWED')
      }
      const mediaFiles = collections.media_files as UploadedFileRecord[]
      const nextMediaFiles = this.uploads
        ? this.uploads.detachResourceAttachmentsFromRecords(mediaFiles, userId, [{
            resourceType: 'profile-message',
            resourceId: message.id
          }])
        : mediaFiles
      return {
        records: {
          ...collections,
          profile_messages: messages.filter(item => item.id !== message.id),
          media_files: nextMediaFiles
        },
        result: undefined
      }
    })
  }

  async setMessageFavorite(userId: string, recipientProfileId: string, messageId: string, actorProfileId: string, isFavorite: boolean): Promise<ProfileMessage> {
    return this.data.transaction<ProfileMessage>(['accounts', 'profile_messages'], collections => {
      const account = (collections.accounts as AccountRecord[]).find(item => item.id === userId)
      if (!account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
      if (!account.profiles.includes(recipientProfileId) || actorProfileId !== recipientProfileId) {
        throw new ForbiddenException('PROFILE_MESSAGE_FAVORITE_NOT_ALLOWED')
      }
      const messages = collections.profile_messages as ProfileMessage[]
      const message = messages.find(item => item.id === messageId && item.toProfileId === recipientProfileId)
      if (!message) throw new NotFoundException('PROFILE_MESSAGE_NOT_FOUND')
      const updated = { ...message, isFavorite }
      return {
        records: {
          ...collections,
          profile_messages: messages.map(item => item.id === message.id ? updated : item)
        },
        result: updated
      }
    })
  }
}
