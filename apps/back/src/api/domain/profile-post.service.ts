import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Optional } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { ProfilePost } from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import { UploadsService } from '../uploads/uploads.service'
import { getRichTextPlainText, sanitizeRichText } from './rich-text-sanitizer'

@Injectable()
export class ProfilePostService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    @Optional() private readonly uploads?: UploadsService
  ) {}

  async createProfilePost(userId: string, profileId: string, content: string): Promise<ProfilePost> {
    const normalized = sanitizeRichText(content)
    const plainText = getRichTextPlainText(normalized)
    const hasImage = /<img\\b/i.test(normalized)
    const post: ProfilePost = {
      id: randomUUID(),
      profileId,
      content: normalized,
      createdAt: Date.now()
    }

    if ((!plainText && !hasImage) || normalized.length > 8000) {
      throw new ConflictException('INVALID_POST')
    }

    const imageIds = this.uploads?.getEditorImageIds(normalized) ?? []
    try {
      return await this.data.createProfilePost(userId, post, imageIds)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('PROFILE_NOT_OWNED')) {
        throw new ForbiddenException('PROFILE_NOT_OWNED')
      }
      if (message.includes('INVALID_EDITOR_IMAGE') || message.includes('EDITOR_IMAGE_ALREADY_ATTACHED')) {
        throw new BadRequestException('INVALID_EDITOR_IMAGE')
      }
      throw error
    }
  }
}
