import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, Optional, UnauthorizedException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { PaginatedResult, ProfileMessage } from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { PaginationDto } from '../pagination/pagination.dto'
import { getRichTextPlainText, sanitizeRichText } from './rich-text-sanitizer'
import { UploadsService } from '../uploads/uploads.service'

@Injectable()
export class ProfileMessageService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    @Optional() private readonly uploads?: UploadsService
  ) {}

  async getMessages(profileId: string, userId: string | null, q: PaginationDto): Promise<PaginatedResult<ProfileMessage>> {
    try {
      const page = await this.data.getProfileMessages(profileId, userId, q.page)
      return {
        ...page,
        items: page.items.map(message => ({
          ...message,
          content: sanitizeRichText(message.content ?? '')
        }))
      }
    } catch (error) {
      this.throwRelationalWriteError(error)
    }
  }

  async sendMessage(userId: string, fromProfileId: string, toProfileId: string, content: string): Promise<ProfileMessage> {
    const normalized = sanitizeRichText(content)
    const plainText = getRichTextPlainText(normalized)
    const hasImage = /<img\\b/i.test(normalized)
    const message: ProfileMessage = {
      id: randomUUID(),
      fromProfileId,
      toProfileId,
      content: normalized,
      createdAt: Date.now(),
      isFavorite: false
    }

    if ((!plainText && !hasImage) || normalized.length > 8000) {
      throw new ConflictException('INVALID_MESSAGE')
    }

    const imageIds = this.uploads?.getEditorImageIds(normalized) ?? []
    try {
      return await this.data.createProfileMessage({ userId, message, imageIds })
    } catch (error) {
      this.throwRelationalWriteError(error)
    }
  }

  async deleteMessage(userId: string, recipientProfileId: string, messageId: string, actorProfileId: string): Promise<void> {
    try {
      await this.data.deleteProfileMessage({ userId, recipientProfileId, messageId, actorProfileId })
    } catch (error) {
      this.throwRelationalWriteError(error)
    }
  }

  async setMessageFavorite(userId: string, recipientProfileId: string, messageId: string, actorProfileId: string, isFavorite: boolean): Promise<ProfileMessage> {
    try {
      return await this.data.setProfileMessageFavorite({
        userId, recipientProfileId, messageId, actorProfileId, isFavorite
      })
    } catch (error) {
      this.throwRelationalWriteError(error)
    }
  }

  private throwRelationalWriteError(error: unknown): never {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('ACCOUNT_NOT_FOUND')) {
      throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
    }
    if (message.includes('PROFILE_NOT_OWNED')) {
      throw new ForbiddenException('PROFILE_NOT_OWNED')
    }
    if (message.includes('PROFILE_TYPE_MISMATCH')) {
      throw new ForbiddenException('PROFILE_TYPE_MISMATCH')
    }
    if (message.includes('PROFILE_NOT_FOUND')) {
      throw new NotFoundException('PROFILE_NOT_FOUND')
    }
    if (message.includes('PROFILE_MESSAGE_FRIENDS_ONLY')) {
      throw new ForbiddenException('PROFILE_MESSAGE_FRIENDS_ONLY')
    }
    if (message.includes('INVALID_EDITOR_IMAGE') || message.includes('EDITOR_IMAGE_ALREADY_ATTACHED')) {
      throw new BadRequestException(message.includes('EDITOR_IMAGE_ALREADY_ATTACHED')
        ? 'EDITOR_IMAGE_ALREADY_ATTACHED'
        : 'INVALID_EDITOR_IMAGE')
    }
    if (message.includes('INVALID_MESSAGE')) {
      throw new ConflictException('INVALID_MESSAGE')
    }
    if (message.includes('PROFILE_MESSAGE_NOT_FOUND')) {
      throw new NotFoundException('PROFILE_MESSAGE_NOT_FOUND')
    }
    if (message.includes('PROFILE_MESSAGE_DELETE_NOT_ALLOWED')) {
      throw new ForbiddenException('PROFILE_MESSAGE_DELETE_NOT_ALLOWED')
    }
    if (message.includes('PROFILE_MESSAGE_FAVORITE_NOT_ALLOWED')) {
      throw new ForbiddenException('PROFILE_MESSAGE_FAVORITE_NOT_ALLOWED')
    }
    throw error
  }
}
