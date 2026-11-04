import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Optional
} from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type {
  CommunityForumReply,
  CommunityForumTopic,
  CommunityForumTopicDetail,
  CommunityForumTopicSummary,
  PaginatedResult
} from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import { paginate, type PaginationDto } from '../pagination/pagination.dto'
import { getRichTextPlainText, sanitizeRichText } from './rich-text-sanitizer'
import { UploadsService } from '../uploads/uploads.service'
import { DomainAccessService } from './domain-access.service'

@Injectable()
export class CommunityForumService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly access: DomainAccessService,
    @Optional() private readonly uploads?: UploadsService
  ) {}

  async listCommunityForumTopics(communityId: string, q: PaginationDto, userId: string | null = null): Promise<PaginatedResult<CommunityForumTopicSummary>> {
    await this.access.assertCommunityReadable(communityId, userId)
    const [topics, replies] = await Promise.all([this.data.read<CommunityForumTopic>('community_forum_topics'), this.data.read<CommunityForumReply>('community_forum_replies')])
    const replyCounts = new Map<string, number>()
    for (const reply of replies) replyCounts.set(reply.topicId, (replyCounts.get(reply.topicId) ?? 0) + 1)
    const visible = topics.filter(topic => topic.communityId === communityId)
      .map(topic => ({ ...topic, replyCount: replyCounts.get(topic.id) ?? 0 }))
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
    return paginate(visible, q)
  }

  async getCommunityForumTopic(communityId: string, topicId: string, q: PaginationDto, userId: string | null = null): Promise<CommunityForumTopicDetail> {
    await this.access.assertCommunityReadable(communityId, userId)
    const topics = await this.data.read<CommunityForumTopic>('community_forum_topics')
    const topic = topics.find(record => record.id === topicId && record.communityId === communityId)
    if (!topic) throw new NotFoundException('FORUM_TOPIC_NOT_FOUND')
    const replies = (await this.data.read<CommunityForumReply>('community_forum_replies'))
      .filter(reply => reply.topicId === topicId && reply.communityId === communityId)
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
    return { topic: { ...topic, replyCount: replies.length }, replies: paginate(replies, q) }
  }

  async createCommunityForumTopic(userId: string, communityId: string, profileId: string, rawTitle: string, rawContent: string): Promise<CommunityForumTopic> {
    await this.access.assertForumMember(userId, profileId, communityId)
    const title = rawTitle.trim().replace(/\s+/g, ' ')
    const content = sanitizeRichText(rawContent)
    await this.uploads?.validateEditorImages(userId, content)
    const plainText = getRichTextPlainText(content)
    if (!title || title.length > 140 || !plainText || plainText.length > 8000 || content.length > 12000) throw new BadRequestException('INVALID_FORUM_TOPIC')
    const now = Date.now()
    const topic: CommunityForumTopic = { id: randomUUID(), communityId, profileId, title, content, createdAt: now, updatedAt: now, isPinned: false, isLocked: false }
    await this.data.update<CommunityForumTopic>('community_forum_topics', topics => [...topics, topic])
    try {
      await this.uploads?.attachEditorImages(userId, content, 'community-forum-topic', topic.id)
    } catch (error) {
      const rollbackErrors: unknown[] = []
      try {
        await this.data.update<CommunityForumTopic>('community_forum_topics', currentTopics =>
          currentTopics.filter(item => item.id !== topic.id)
        )
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
      try {
        await this.uploads?.detachResourceAttachments(userId, 'community-forum-topic', topic.id)
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
      if (rollbackErrors.length > 0) throw new InternalServerErrorException('FORUM_TOPIC_CREATE_ROLLBACK_FAILED')
      throw error
    }
    return topic
  }

  async createCommunityForumReply(userId: string, communityId: string, topicId: string, profileId: string, rawContent: string): Promise<CommunityForumReply> {
    await this.access.assertForumMember(userId, profileId, communityId)
    const topics = await this.data.read<CommunityForumTopic>('community_forum_topics')
    const topic = topics.find(record => record.id === topicId && record.communityId === communityId)
    if (!topic) throw new NotFoundException('FORUM_TOPIC_NOT_FOUND')
    if (topic.isLocked) throw new ForbiddenException('FORUM_TOPIC_LOCKED')
    const content = sanitizeRichText(rawContent)
    await this.uploads?.validateEditorImages(userId, content)
    const plainText = getRichTextPlainText(content)
    if (!plainText || plainText.length > 8000 || content.length > 12000) throw new BadRequestException('INVALID_FORUM_REPLY')
    const now = Date.now()
    const reply: CommunityForumReply = { id: randomUUID(), topicId, communityId, profileId, content, createdAt: now, updatedAt: now }
    await this.data.update<CommunityForumReply>('community_forum_replies', replies => [...replies, reply])
    try {
      await this.uploads?.attachEditorImages(userId, content, 'community-forum-reply', reply.id)
      await this.data.update<CommunityForumTopic>('community_forum_topics', currentTopics => {
        const latestTopic = currentTopics.find(record => record.id === topicId && record.communityId === communityId)
        if (!latestTopic) throw new NotFoundException('FORUM_TOPIC_NOT_FOUND')
        if (latestTopic.isLocked) throw new ForbiddenException('FORUM_TOPIC_LOCKED')
        return currentTopics.map(record => record.id === topicId ? { ...record, updatedAt: now } : record)
      })
    } catch (error) {
      const rollbackErrors: unknown[] = []
      try {
        await this.data.update<CommunityForumReply>('community_forum_replies', currentReplies =>
          currentReplies.filter(item => item.id !== reply.id)
        )
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
      try {
        await this.uploads?.detachResourceAttachments(userId, 'community-forum-reply', reply.id)
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
      if (rollbackErrors.length > 0) throw new InternalServerErrorException('FORUM_REPLY_CREATE_ROLLBACK_FAILED')
      throw error
    }
    return reply
  }

  async moderateCommunityForumTopic(userId: string, communityId: string, topicId: string, profileId: string, changes: { isPinned?: boolean; isLocked?: boolean }): Promise<CommunityForumTopic> {
    await this.access.assertForumStaff(userId, profileId, communityId)
    let updated: CommunityForumTopic | undefined
    await this.data.update<CommunityForumTopic>('community_forum_topics', topics => {
      const topic = topics.find(record => record.id === topicId && record.communityId === communityId)
      if (!topic) throw new NotFoundException('FORUM_TOPIC_NOT_FOUND')
      updated = {
        ...topic,
        ...(typeof changes.isPinned === 'boolean' ? { isPinned: changes.isPinned } : {}),
        ...(typeof changes.isLocked === 'boolean' ? { isLocked: changes.isLocked } : {}),
        updatedAt: Date.now()
      }
      return topics.map(record => record.id === topicId ? updated! : record)
    })
    return updated!
  }

  async deleteCommunityForumTopic(userId: string, communityId: string, topicId: string, actorProfileId: string): Promise<void> {
    await this.access.assertOwns(userId, actorProfileId, { allowDifferentActiveType: true })
    await this.access.ensureCommunity(communityId)
    const [profiles, communities] = await Promise.all([this.access.readProfiles(), this.access.readCommunities()])
    this.access.assertSameType(profiles.find(profile => profile.id === actorProfileId), communities.find(community => community.id === communityId))
    const topics = await this.data.read<CommunityForumTopic>('community_forum_topics')
    const topic = topics.find(record => record.id === topicId && record.communityId === communityId)
    if (!topic) throw new NotFoundException('FORUM_TOPIC_NOT_FOUND')
    const role = this.access.role(actorProfileId, await this.access.readCommunityRelationships(communityId))
    if (topic.profileId !== actorProfileId && role !== 'owner' && role !== 'moderator') throw new ForbiddenException('FORUM_DELETE_NOT_ALLOWED')
    await this.data.update<CommunityForumTopic>('community_forum_topics', current =>
      current.filter(record => record.id !== topicId)
    )
    let topicReplies: CommunityForumReply[] = []
    await this.data.update<CommunityForumReply>('community_forum_replies', current => {
      topicReplies = current.filter(reply => reply.topicId === topicId)
      return current.filter(reply => reply.topicId !== topicId)
    })
    await this.uploads?.detachResourceAttachments(null, 'community-forum-topic', topicId)
    for (const reply of topicReplies) {
      await this.uploads?.detachResourceAttachments(null, 'community-forum-reply', reply.id)
    }
  }

  async deleteCommunityForumReply(userId: string, communityId: string, replyId: string, actorProfileId: string): Promise<void> {
    await this.access.assertOwns(userId, actorProfileId, { allowDifferentActiveType: true })
    await this.access.ensureCommunity(communityId)
    const [profiles, communities] = await Promise.all([this.access.readProfiles(), this.access.readCommunities()])
    this.access.assertSameType(profiles.find(profile => profile.id === actorProfileId), communities.find(community => community.id === communityId))
    const replies = await this.data.read<CommunityForumReply>('community_forum_replies')
    const reply = replies.find(record => record.id === replyId && record.communityId === communityId)
    if (!reply) throw new NotFoundException('FORUM_REPLY_NOT_FOUND')
    const role = this.access.role(actorProfileId, await this.access.readCommunityRelationships(communityId))
    if (reply.profileId !== actorProfileId && role !== 'owner' && role !== 'moderator') throw new ForbiddenException('FORUM_DELETE_NOT_ALLOWED')
    await this.data.update<CommunityForumReply>('community_forum_replies', current =>
      current.filter(record => record.id !== replyId)
    )
    await this.uploads?.detachResourceAttachments(null, 'community-forum-reply', replyId)
    await this.data.update<CommunityForumTopic>('community_forum_topics', topics =>
      topics.map(topic => topic.id === reply.topicId ? { ...topic, updatedAt: Date.now() } : topic)
    )
  }

}
