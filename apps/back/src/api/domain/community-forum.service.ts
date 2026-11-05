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
import { paginate, type PaginationDto } from '../pagination/pagination.dto'
import { getRichTextPlainText, sanitizeRichText } from './rich-text-sanitizer'
import { UploadsService, type UploadedFileRecord } from '../uploads/uploads.service'
import { DomainAccessService } from './domain-access.service'
import type { AccountRecord } from '../auth/auth.types'

@Injectable()
export class CommunityForumService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly access: DomainAccessService,
    @Optional() private readonly uploads?: UploadsService
  ) {}

  async listCommunityForumTopics(communityId: string, q: PaginationDto, userId: string | null = null): Promise<PaginatedResult<CommunityForumTopicSummary>> {
    return this.data.transaction<PaginatedResult<CommunityForumTopicSummary>>(
      ['accounts', 'profiles', 'communities', 'community_relationships', 'community_forum_topics', 'community_forum_replies'],
      collections => {
        const normalized = this.access.normalizeCommunitiesInRecords(collections)
        const records = normalized.records
        this.access.assertCommunityReadableInRecords(
          communityId, userId,
          records.accounts as AccountRecord[],
          normalized.communities,
          records.community_relationships as CommunityRelationship[]
        )
        const topics = records.community_forum_topics as CommunityForumTopic[]
        const replies = records.community_forum_replies as CommunityForumReply[]
        const replyCounts = new Map<string, number>()
        for (const reply of replies) {
          replyCounts.set(reply.topicId, (replyCounts.get(reply.topicId) ?? 0) + 1)
        }
        const visible = topics.filter(topic => topic.communityId === communityId)
          .map(topic => ({ ...topic, replyCount: replyCounts.get(topic.id) ?? 0 }))
          .sort((a, b) =>
            Number(b.isPinned) - Number(a.isPinned) ||
            b.updatedAt - a.updatedAt ||
            a.id.localeCompare(b.id)
          )
        return { records, result: paginate(visible, q) }
      }
    )
  }

  async getCommunityForumTopic(communityId: string, topicId: string, q: PaginationDto, userId: string | null = null): Promise<CommunityForumTopicDetail> {
    return this.data.transaction<CommunityForumTopicDetail>(
      ['accounts', 'profiles', 'communities', 'community_relationships', 'community_forum_topics', 'community_forum_replies'],
      collections => {
        const normalized = this.access.normalizeCommunitiesInRecords(collections)
        const records = normalized.records
        this.access.assertCommunityReadableInRecords(
          communityId, userId,
          records.accounts as AccountRecord[],
          normalized.communities,
          records.community_relationships as CommunityRelationship[]
        )
        const topics = records.community_forum_topics as CommunityForumTopic[]
        const topic = topics.find(record =>
          record.id === topicId && record.communityId === communityId
        )
        if (!topic) throw new NotFoundException('FORUM_TOPIC_NOT_FOUND')
        const replies = (records.community_forum_replies as CommunityForumReply[])
          .filter(reply => reply.topicId === topicId && reply.communityId === communityId)
          .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
        return {
          records,
          result: {
            topic: { ...topic, replyCount: replies.length },
            replies: paginate(replies, q)
          }
        }
      }
    )
  }

  async createCommunityForumTopic(userId: string, communityId: string, profileId: string, rawTitle: string, rawContent: string): Promise<CommunityForumTopic> {
    const title = rawTitle.trim().replace(/\s+/g, ' ')
    const content = sanitizeRichText(rawContent)
    const plainText = getRichTextPlainText(content)
    const now = Date.now()
    const topic: CommunityForumTopic = {
      id: randomUUID(), communityId, profileId, title, content,
      createdAt: now, updatedAt: now, isPinned: false, isLocked: false
    }

    await this.data.transaction(
      ['accounts', 'profiles', 'communities', 'community_relationships', 'community_forum_topics', 'media_files'],
      collections => {
        this.access.assertForumMemberInRecords(
          userId,
          profileId,
          communityId,
          collections.accounts as AccountRecord[],
          collections.profiles as Profile[],
          collections.communities as Community[],
          collections.community_relationships as CommunityRelationship[]
        )
        if (!title || title.length > 140 || !plainText || plainText.length > 8000 || content.length > 12000) {
          throw new BadRequestException('INVALID_FORUM_TOPIC')
        }

        const topics = collections.community_forum_topics as CommunityForumTopic[]
        const mediaFiles = collections.media_files as UploadedFileRecord[]
        const nextMediaFiles = this.uploads
          ? this.uploads.attachEditorImagesToRecords(
              mediaFiles, userId, content, 'community-forum-topic', topic.id
            )
          : mediaFiles
        return {
          records: {
            ...collections,
            community_forum_topics: [...topics, topic],
            media_files: nextMediaFiles
          },
          result: undefined
        }
      }
    )
    return topic
  }

  async createCommunityForumReply(userId: string, communityId: string, topicId: string, profileId: string, rawContent: string): Promise<CommunityForumReply> {
    const content = sanitizeRichText(rawContent)
    const plainText = getRichTextPlainText(content)
    const now = Date.now()
    const reply: CommunityForumReply = {
      id: randomUUID(), topicId, communityId, profileId, content, createdAt: now, updatedAt: now
    }

    await this.data.transaction(
      ['accounts', 'profiles', 'communities', 'community_relationships', 'community_forum_replies', 'community_forum_topics', 'media_files'],
      collections => {
        this.access.assertForumMemberInRecords(
          userId,
          profileId,
          communityId,
          collections.accounts as AccountRecord[],
          collections.profiles as Profile[],
          collections.communities as Community[],
          collections.community_relationships as CommunityRelationship[]
        )
        const replies = collections.community_forum_replies as CommunityForumReply[]
        const currentTopics = collections.community_forum_topics as CommunityForumTopic[]
        const latestTopic = currentTopics.find(record =>
          record.id === topicId && record.communityId === communityId
        )
        if (!latestTopic) throw new NotFoundException('FORUM_TOPIC_NOT_FOUND')
        if (latestTopic.isLocked) throw new ForbiddenException('FORUM_TOPIC_LOCKED')
        if (!plainText || plainText.length > 8000 || content.length > 12000) {
          throw new BadRequestException('INVALID_FORUM_REPLY')
        }

        const mediaFiles = collections.media_files as UploadedFileRecord[]
        const nextMediaFiles = this.uploads
          ? this.uploads.attachEditorImagesToRecords(
              mediaFiles, userId, content, 'community-forum-reply', reply.id
            )
          : mediaFiles
        return {
          records: {
            ...collections,
            community_forum_replies: [...replies, reply],
            community_forum_topics: currentTopics.map(record =>
              record.id === topicId ? { ...record, updatedAt: now } : record
            ),
            media_files: nextMediaFiles
          },
          result: undefined
        }
      }
    )
    return reply
  }

  async moderateCommunityForumTopic(userId: string, communityId: string, topicId: string, profileId: string, changes: { isPinned?: boolean; isLocked?: boolean }): Promise<CommunityForumTopic> {
    const now = Date.now()
    return this.data.transaction<CommunityForumTopic>(
      ['accounts', 'profiles', 'communities', 'community_relationships', 'community_forum_topics'],
      collections => {
        this.access.assertForumStaffInRecords(
          userId,
          profileId,
          communityId,
          collections.accounts as AccountRecord[],
          collections.profiles as Profile[],
          collections.communities as Community[],
          collections.community_relationships as CommunityRelationship[]
        )
        const topics = collections.community_forum_topics as CommunityForumTopic[]
        const topic = topics.find(record => record.id === topicId && record.communityId === communityId)
        if (!topic) throw new NotFoundException('FORUM_TOPIC_NOT_FOUND')
        const updated: CommunityForumTopic = {
          ...topic,
          ...(typeof changes.isPinned === 'boolean' ? { isPinned: changes.isPinned } : {}),
          ...(typeof changes.isLocked === 'boolean' ? { isLocked: changes.isLocked } : {}),
          updatedAt: now
        }
        return {
          records: {
            ...collections,
            community_forum_topics: topics.map(record => record.id === topicId ? updated : record)
          },
          result: updated
        }
      }
    )
  }

  async deleteCommunityForumTopic(userId: string, communityId: string, topicId: string, actorProfileId: string): Promise<void> {
    await this.data.transaction(
      ['accounts', 'profiles', 'communities', 'community_relationships', 'community_forum_topics', 'community_forum_replies', 'media_files'],
      collections => {
        const context = this.access.assertCommunityProfileInRecords(
          userId,
          actorProfileId,
          communityId,
          collections.accounts as AccountRecord[],
          collections.profiles as Profile[],
          collections.communities as Community[],
          collections.community_relationships as CommunityRelationship[],
          { allowDifferentActiveType: true }
        )
        const currentTopics = collections.community_forum_topics as CommunityForumTopic[]
        const currentReplies = collections.community_forum_replies as CommunityForumReply[]
        const latestTopic = currentTopics.find(record =>
          record.id === topicId && record.communityId === communityId
        )
        if (!latestTopic) throw new NotFoundException('FORUM_TOPIC_NOT_FOUND')
        if (
          latestTopic.profileId !== actorProfileId &&
          context.role !== 'owner' &&
          context.role !== 'moderator'
        ) {
          throw new ForbiddenException('FORUM_DELETE_NOT_ALLOWED')
        }

        const topicReplies = currentReplies.filter(reply =>
          reply.topicId === topicId && reply.communityId === communityId
        )
        const resources = [
          { resourceType: 'community-forum-topic' as const, resourceId: topicId },
          ...topicReplies.map(reply => ({
            resourceType: 'community-forum-reply' as const,
            resourceId: reply.id
          }))
        ]
        const mediaFiles = collections.media_files as UploadedFileRecord[]
        const nextMediaFiles = this.uploads
          ? this.uploads.detachResourceAttachmentsFromRecords(mediaFiles, null, resources)
          : mediaFiles
        return {
          records: {
            ...collections,
            community_forum_topics: currentTopics.filter(record => record.id !== topicId),
            community_forum_replies: currentReplies.filter(reply =>
              reply.topicId !== topicId || reply.communityId !== communityId
            ),
            media_files: nextMediaFiles
          },
          result: undefined
        }
      }
    )
  }

  async deleteCommunityForumReply(userId: string, communityId: string, replyId: string, actorProfileId: string): Promise<void> {
    const now = Date.now()
    await this.data.transaction(
      ['accounts', 'profiles', 'communities', 'community_relationships', 'community_forum_replies', 'community_forum_topics', 'media_files'],
      collections => {
        const context = this.access.assertCommunityProfileInRecords(
          userId,
          actorProfileId,
          communityId,
          collections.accounts as AccountRecord[],
          collections.profiles as Profile[],
          collections.communities as Community[],
          collections.community_relationships as CommunityRelationship[],
          { allowDifferentActiveType: true }
        )
        const currentReplies = collections.community_forum_replies as CommunityForumReply[]
        const currentTopics = collections.community_forum_topics as CommunityForumTopic[]
        const latestReply = currentReplies.find(record =>
          record.id === replyId && record.communityId === communityId
        )
        if (!latestReply) throw new NotFoundException('FORUM_REPLY_NOT_FOUND')
        if (
          latestReply.profileId !== actorProfileId &&
          context.role !== 'owner' &&
          context.role !== 'moderator'
        ) {
          throw new ForbiddenException('FORUM_DELETE_NOT_ALLOWED')
        }

        const mediaFiles = collections.media_files as UploadedFileRecord[]
        const nextMediaFiles = this.uploads
          ? this.uploads.detachResourceAttachmentsFromRecords(mediaFiles, null, [{
              resourceType: 'community-forum-reply',
              resourceId: replyId
            }])
          : mediaFiles
        return {
          records: {
            ...collections,
            community_forum_replies: currentReplies.filter(record => record.id !== replyId),
            community_forum_topics: currentTopics.map(topic =>
              topic.id === latestReply.topicId ? { ...topic, updatedAt: now } : topic
            ),
            media_files: nextMediaFiles
          },
          result: undefined
        }
      }
    )
  }

}