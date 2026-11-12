import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional
} from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type {
  Community,
  CommunityForumReply,
  CommunityForumTopic,
  CommunityForumTopicDetail,
  CommunityForumTopicSummary,
  CommunityRelationship,
  PaginatedResult,
  Profile
} from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { ForumTopicModerationChanges } from './domain.types'
import { paginate } from '../pagination/pagination.helper'
import type { PaginationDto } from '../pagination/pagination.dto'
import { getRichTextPlainText, sanitizeRichText } from './rich-text-sanitizer'
import { UploadsService } from '../uploads/uploads.service'
import type { UploadedFileRecord } from '../uploads/uploads.types'
import { DomainAccessService } from './domain-access.service'
import type { AccountRecord } from '../auth/auth.types'
import { CommunityForumRealtimeService } from './community-forum-realtime.service'

@Injectable()
export class CommunityForumService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly access: DomainAccessService,
    @Optional() private readonly uploads?: UploadsService,
    @Optional() private readonly realtime?: CommunityForumRealtimeService
  ) {}

  async listCommunityForumTopics(communityId: string, q: PaginationDto, userId: string | null = null): Promise<PaginatedResult<CommunityForumTopicSummary>> {
    try {
      return await this.data.listCommunityForumTopics(communityId, userId, q.page)
    } catch (error) {
      this.throwRelationalWriteError(error)
    }

  }

  async getCommunityForumTopic(communityId: string, topicId: string, q: PaginationDto, userId: string | null = null): Promise<CommunityForumTopicDetail> {
    try {
      return await this.data.getCommunityForumTopic(communityId, topicId, userId, q.page)
    } catch (error) {
      this.throwRelationalWriteError(error)
    }

  }

  async createCommunityForumTopic(userId: string, communityId: string, profileId: string, rawTitle: string, rawContent: string): Promise<CommunityForumTopic> {
    const title = rawTitle.trim().replace(/\s+/g, ' ')
    const content = sanitizeRichText(rawContent)
    const plainText = getRichTextPlainText(content)
    const hasImage = /<img\b/i.test(content)
    const now = Date.now()
    const topic: CommunityForumTopic = {
      id: randomUUID(), communityId, profileId, title, content,
      createdAt: now, updatedAt: now, isPinned: false, isLocked: false
    }

    if (!title || title.length > 140 || (!plainText && !hasImage) || content.length > 8000) {
      throw new BadRequestException('INVALID_FORUM_TOPIC')
    }
    const imageIds = this.uploads?.getEditorImageIds(content) ?? []
    try {
      const created = await this.data.createCommunityForumTopic({ userId, topic, imageIds })
      await this.realtime?.publishTopicChanged(created.id)
      return created
    } catch (error) {
      this.throwRelationalWriteError(error)
    }

  }

  async createCommunityForumReply(userId: string, communityId: string, topicId: string, profileId: string, rawContent: string): Promise<CommunityForumReply> {
    const content = sanitizeRichText(rawContent)
    const plainText = getRichTextPlainText(content)
    const hasImage = /<img\b/i.test(content)
    const now = Date.now()
    const reply: CommunityForumReply = {
      id: randomUUID(), topicId, communityId, profileId, content, createdAt: now, updatedAt: now
    }

    if ((!plainText && !hasImage) || content.length > 8000) {
      throw new BadRequestException('INVALID_FORUM_REPLY')
    }
    const imageIds = this.uploads?.getEditorImageIds(content) ?? []
    try {
      const created = await this.data.createCommunityForumReply({ userId, reply, imageIds })
      await this.realtime?.publishTopicChanged(topicId)
      return created
    } catch (error) {
      this.throwRelationalWriteError(error)
    }

  }

  async moderateCommunityForumTopic(userId: string, communityId: string, topicId: string, profileId: string, changes: ForumTopicModerationChanges): Promise<CommunityForumTopic> {
    const now = Date.now()
    try {
      const updated = await this.data.moderateCommunityForumTopic({
        userId, communityId, topicId, actorProfileId: profileId, ...changes, updatedAt: now
      })
      await this.realtime?.publishTopicChanged(topicId)
      return updated
    } catch (error) {
      this.throwRelationalWriteError(error)
    }

  }

  async deleteCommunityForumTopic(userId: string, communityId: string, topicId: string, actorProfileId: string): Promise<void> {
    const now = Date.now()
    try {
      await this.data.deleteCommunityForumTopic({ userId, communityId, topicId, actorProfileId, updatedAt: now })
      await this.realtime?.publishTopicChanged(topicId)
      return
    } catch (error) {
      this.throwRelationalWriteError(error)
    }

  }

  async deleteCommunityForumReply(userId: string, communityId: string, replyId: string, actorProfileId: string): Promise<void> {
    const now = Date.now()
    try {
      const topicId = await this.data.deleteCommunityForumReply({
        userId, communityId, replyId, actorProfileId, updatedAt: now
      })
      await this.realtime?.publishTopicChanged(topicId)
      return
    } catch (error) {
      this.throwRelationalWriteError(error)
    }

  }


  private throwRelationalWriteError(error: unknown): never {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('ACCOUNT_NOT_FOUND')) throw new NotFoundException('ACCOUNT_NOT_FOUND')
    if (message.includes('PROFILE_NOT_OWNED')) throw new ForbiddenException('PROFILE_NOT_OWNED')
    if (message.includes('PROFILE_NOT_FOUND')) throw new NotFoundException('PROFILE_NOT_FOUND')
    if (message.includes('COMMUNITY_NOT_FOUND')) throw new NotFoundException('COMMUNITY_NOT_FOUND')
    if (message.includes('PROFILE_TYPE_MISMATCH')) throw new ForbiddenException('PROFILE_TYPE_MISMATCH')
    if (message.includes('COMMUNITY_MEMBER_REQUIRED')) throw new ForbiddenException('COMMUNITY_MEMBER_REQUIRED')
    if (message.includes('COMMUNITY_STAFF_REQUIRED')) throw new ForbiddenException('COMMUNITY_STAFF_REQUIRED')
    if (message.includes('FORUM_TOPIC_NOT_FOUND')) throw new NotFoundException('FORUM_TOPIC_NOT_FOUND')
    if (message.includes('FORUM_REPLY_NOT_FOUND')) throw new NotFoundException('FORUM_REPLY_NOT_FOUND')
    if (message.includes('FORUM_TOPIC_LOCKED')) throw new ForbiddenException('FORUM_TOPIC_LOCKED')
    if (message.includes('FORUM_DELETE_NOT_ALLOWED')) throw new ForbiddenException('FORUM_DELETE_NOT_ALLOWED')
    if (message.includes('INVALID_FORUM_TOPIC')) throw new BadRequestException('INVALID_FORUM_TOPIC')
    if (message.includes('INVALID_FORUM_REPLY')) throw new BadRequestException('INVALID_FORUM_REPLY')
    if (message.includes('INVALID_EDITOR_IMAGE')) throw new BadRequestException('INVALID_EDITOR_IMAGE')
    if (message.includes('EDITOR_IMAGE_ALREADY_ATTACHED')) throw new BadRequestException('EDITOR_IMAGE_ALREADY_ATTACHED')
    throw error
  }

}