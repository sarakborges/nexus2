import type { CommunityForumPageData, CommunityForumReply, CommunityForumReplyRemoval, CommunityForumReplyWrite, CommunityForumTopic, CommunityForumTopicDetail, CommunityForumTopicModerationWrite, CommunityForumTopicPageData, CommunityForumTopicRemoval, CommunityForumTopicSummary, CommunityForumTopicWrite, ListSort, PaginatedResult } from '../repository.types'
import { SupabaseRepositoryClient } from '../supabase-repository.client'
import type { CommunityForumRepository } from '../contracts/communityForum.repository.interface'

export class SupabaseCommunityForumRepository extends SupabaseRepositoryClient implements CommunityForumRepository {
  constructor(projectUrl: string, publishableKey: string, apiSecret: string) {
    super(projectUrl, publishableKey, apiSecret)
  }

  async listCommunityForumTopics(
    communityId: string,
    userId: string | null,
    page: number
  ): Promise<PaginatedResult<CommunityForumTopicSummary>> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_community_forum_topics', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_community_id: communityId, p_user_id: userId, p_page: page })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) throw new Error('Supabase forum topics returned an invalid result.')
    const record = result as Record<string, unknown>
    if (!Array.isArray(record.items) || record.pageSize !== 20 || !Number.isSafeInteger(record.totalItems) || !Number.isSafeInteger(record.totalPages)) {
      throw new Error('Supabase forum topics returned invalid pagination data.')
    }
    return result as PaginatedResult<CommunityForumTopicSummary>
  }

  async getCommunityForumTopic(
    communityId: string,
    topicId: string,
    userId: string | null,
    page: number
  ): Promise<CommunityForumTopicDetail> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_community_forum_topic', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_community_id: communityId,
        p_topic_id: topicId,
        p_user_id: userId,
        p_page: page
      })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null || !('topic' in result) || !('replies' in result)) {
      throw new Error('Supabase forum topic returned an invalid result.')
    }
    return result as CommunityForumTopicDetail
  }

  async getCommunityForumPage(
    url: string,
    userId: string | null,
    page: number,
    query: string | undefined,
    sort: ListSort
  ): Promise<CommunityForumPageData> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_community_forum_page', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_url: url,
        p_user_id: userId,
        p_page: page,
        p_query: query ?? null,
        p_sort: sort
      })
    })
    await this.assertSuccess(response)

    const result: unknown = await response.json()
    if (
      typeof result !== 'object' || result === null ||
      !('canReadForum' in result) || typeof result.canReadForum !== 'boolean' ||
      !('canPublish' in result) || typeof result.canPublish !== 'boolean' ||
      !('topics' in result) || typeof result.topics !== 'object' || result.topics === null ||
      !('authors' in result) || !Array.isArray(result.authors)
    ) {
      throw new Error('Supabase community forum page returned an invalid result.')
    }
    const pageResult = result as CommunityForumPageData
    if (
      !pageResult.topics ||
      !Array.isArray(pageResult.topics.items) ||
      pageResult.topics.pageSize !== 20 ||
      !Number.isSafeInteger(pageResult.topics.totalItems) ||
      !Number.isSafeInteger(pageResult.topics.totalPages) ||
      (pageResult.community !== null && typeof pageResult.community !== 'object') ||
      (pageResult.viewerRelationship !== null && typeof pageResult.viewerRelationship !== 'object') ||
      (pageResult.currentProfileType !== null && typeof pageResult.currentProfileType !== 'string')
    ) {
      throw new Error('Supabase community forum page returned invalid data.')
    }
    return pageResult
  }

  async getCommunityForumTopicPage(
    url: string,
    topicId: string,
    userId: string | null,
    page: number,
    query: string | undefined,
    sort: ListSort
  ): Promise<CommunityForumTopicPageData> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_community_forum_topic_page', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_url: url,
        p_topic_id: topicId,
        p_user_id: userId,
        p_page: page,
        p_query: query ?? null,
        p_sort: sort
      })
    })
    await this.assertSuccess(response)

    const result: unknown = await response.json()
    if (
      typeof result !== 'object' || result === null ||
      !('community' in result) || typeof result.community !== 'object' || result.community === null ||
      !('detail' in result) || typeof result.detail !== 'object' || result.detail === null ||
      !('authors' in result) || !Array.isArray(result.authors) ||
      !('isMember' in result) || typeof result.isMember !== 'boolean' ||
      !('isStaff' in result) || typeof result.isStaff !== 'boolean' ||
      !('forumProfileId' in result)
    ) {
      throw new Error('Supabase community forum topic page returned an invalid result.')
    }
    const pageResult = result as CommunityForumTopicPageData
    if (
      !pageResult.detail.topic ||
      !pageResult.detail.replies ||
      !Array.isArray(pageResult.detail.replies.items) ||
      pageResult.detail.replies.pageSize !== 20 ||
      !Number.isSafeInteger(pageResult.detail.replies.totalItems) ||
      !Number.isSafeInteger(pageResult.detail.replies.totalPages)
    ) {
      throw new Error('Supabase community forum topic page returned invalid data.')
    }
    return pageResult
  }

  async createCommunityForumTopic(change: CommunityForumTopicWrite): Promise<CommunityForumTopic> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_create_community_forum_topic', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_topic_id: change.topic.id,
        p_community_id: change.topic.communityId,
        p_profile_id: change.topic.profileId,
        p_title: change.topic.title,
        p_content: change.topic.content,
        p_created_at_ms: change.topic.createdAt,
        p_image_ids: [...change.imageIds]
      })
    })
    await this.assertSuccess(response)
    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error('Supabase forum topic write returned an invalid result.')
    }
    const row = rows[0] as Record<string, unknown>
    if (
      typeof row.id !== 'string' ||
      typeof row.community_id !== 'string' ||
      typeof row.profile_id !== 'string' ||
      typeof row.title !== 'string' ||
      typeof row.content !== 'string' ||
      !Number.isFinite(Number(row.created_at_ms)) ||
      !Number.isFinite(Number(row.updated_at_ms)) ||
      typeof row.is_pinned !== 'boolean' ||
      typeof row.is_locked !== 'boolean'
    ) throw new Error('Supabase forum topic write returned an invalid row.')
    return {
      id: row.id,
      communityId: row.community_id,
      profileId: row.profile_id,
      title: row.title,
      content: row.content,
      createdAt: Number(row.created_at_ms),
      updatedAt: Number(row.updated_at_ms),
      isPinned: row.is_pinned,
      isLocked: row.is_locked
    }
  }

  async createCommunityForumReply(change: CommunityForumReplyWrite): Promise<CommunityForumReply> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_create_community_forum_reply', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_reply_id: change.reply.id,
        p_topic_id: change.reply.topicId,
        p_community_id: change.reply.communityId,
        p_profile_id: change.reply.profileId,
        p_content: change.reply.content,
        p_created_at_ms: change.reply.createdAt,
        p_updated_at_ms: change.reply.updatedAt,
        p_image_ids: [...change.imageIds]
      })
    })
    await this.assertSuccess(response)
    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error('Supabase forum reply write returned an invalid result.')
    }
    const row = rows[0] as Record<string, unknown>
    if (
      typeof row.id !== 'string' ||
      typeof row.topic_id !== 'string' ||
      typeof row.community_id !== 'string' ||
      typeof row.profile_id !== 'string' ||
      typeof row.content !== 'string' ||
      !Number.isFinite(Number(row.created_at_ms)) ||
      !Number.isFinite(Number(row.updated_at_ms))
    ) throw new Error('Supabase forum reply write returned an invalid row.')
    return {
      id: row.id,
      topicId: row.topic_id,
      communityId: row.community_id,
      profileId: row.profile_id,
      content: row.content,
      createdAt: Number(row.created_at_ms),
      updatedAt: Number(row.updated_at_ms)
    }
  }

  async moderateCommunityForumTopic(change: CommunityForumTopicModerationWrite): Promise<CommunityForumTopic> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_moderate_community_forum_topic', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_community_id: change.communityId,
        p_topic_id: change.topicId,
        p_actor_profile_id: change.actorProfileId,
        p_is_pinned: change.isPinned ?? null,
        p_is_locked: change.isLocked ?? null,
        p_updated_at_ms: change.updatedAt
      })
    })
    await this.assertSuccess(response)
    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error('Supabase forum topic moderation returned an invalid result.')
    }
    const row = rows[0] as Record<string, unknown>
    if (
      typeof row.id !== 'string' ||
      typeof row.community_id !== 'string' ||
      typeof row.profile_id !== 'string' ||
      typeof row.title !== 'string' ||
      typeof row.content !== 'string' ||
      !Number.isFinite(Number(row.created_at_ms)) ||
      !Number.isFinite(Number(row.updated_at_ms)) ||
      typeof row.is_pinned !== 'boolean' ||
      typeof row.is_locked !== 'boolean'
    ) throw new Error('Supabase forum topic moderation returned an invalid row.')
    return {
      id: row.id,
      communityId: row.community_id,
      profileId: row.profile_id,
      title: row.title,
      content: row.content,
      createdAt: Number(row.created_at_ms),
      updatedAt: Number(row.updated_at_ms),
      isPinned: row.is_pinned,
      isLocked: row.is_locked
    }
  }

  async deleteCommunityForumTopic(change: CommunityForumTopicRemoval): Promise<void> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_delete_community_forum_topic', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_community_id: change.communityId,
        p_topic_id: change.topicId,
        p_actor_profile_id: change.actorProfileId,
        p_updated_at_ms: change.updatedAt
      })
    })
    await this.assertSuccess(response)
  }

  async deleteCommunityForumReply(change: CommunityForumReplyRemoval): Promise<string> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_delete_community_forum_reply', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_community_id: change.communityId,
        p_reply_id: change.replyId,
        p_actor_profile_id: change.actorProfileId,
        p_updated_at_ms: change.updatedAt
      })
    })
    await this.assertSuccess(response)
    const topicId: unknown = await response.json()
    if (typeof topicId !== 'string') {
      throw new Error('Supabase forum reply deletion returned an invalid topic identifier.')
    }
    return topicId
  }
}
