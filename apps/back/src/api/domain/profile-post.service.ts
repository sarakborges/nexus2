import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Optional } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { Profile, ProfilePost } from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { AccountRecord } from '../auth/auth.types'
import type { UploadedFileRecord } from '../uploads/uploads.types'
import { UploadsService } from '../uploads/uploads.service'
import { DomainAccessService } from './domain-access.service'
import { getRichTextPlainText, sanitizeRichText } from './rich-text-sanitizer'

@Injectable()
export class ProfilePostService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly access: DomainAccessService,
    @Optional() private readonly uploads?: UploadsService
  ) {}

  async createProfilePost(userId: string, profileId: string, content: string): Promise<ProfilePost> {
    const normalized = sanitizeRichText(content)
    const plainText = getRichTextPlainText(normalized)
    const hasImage = /<img\b/i.test(normalized)
    const post: ProfilePost = { id: randomUUID(), profileId, content: normalized, createdAt: Date.now() }

    if ((!plainText && !hasImage) || normalized.length > 8000) {
      throw new ConflictException('INVALID_POST')
    }

    if (this.data.createProfilePost) {
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

    return this.data.transaction<ProfilePost>(
      ['accounts', 'profiles', 'profile_posts', 'media_files'],
      collections => {
        const accounts = collections.accounts as AccountRecord[]
        const profiles = collections.profiles as Profile[]
        const posts = collections.profile_posts as ProfilePost[]
        const mediaFiles = collections.media_files as UploadedFileRecord[]
        this.access.assertOwnsInRecords(userId, profileId, accounts, profiles)
        const nextMediaFiles = this.uploads
          ? this.uploads.attachEditorImagesToRecords(mediaFiles, userId, normalized, 'profile-post', post.id)
          : mediaFiles
        return {
          records: {
            ...collections,
            profiles: this.access.touchProfilesActivity(profiles, [profileId], post.createdAt),
            profile_posts: [...posts, post],
            media_files: nextMediaFiles
          },
          result: post
        }
      }
    )
  }
}
