import type { CommunityForumPageData, CommunityForumReply, CommunityForumReplyRemoval, CommunityForumReplyWrite, CommunityForumTopic, CommunityForumTopicDetail, CommunityForumTopicModerationWrite, CommunityForumTopicPageData, CommunityForumTopicRemoval, CommunityForumTopicSummary, CommunityForumTopicWrite, ListSort, PaginatedResult } from '../repository.types'

export interface CommunityForumRepository {
  listCommunityForumTopics(
    communityId: string,
    userId: string | null,
    page: number
  ): Promise<PaginatedResult<CommunityForumTopicSummary>>
  getCommunityForumTopic(
    communityId: string,
    topicId: string,
    userId: string | null,
    page: number
  ): Promise<CommunityForumTopicDetail>
  getCommunityForumPage(
    url: string,
    userId: string | null,
    page: number,
    query: string | undefined,
    sort: ListSort
  ): Promise<CommunityForumPageData>
  getCommunityForumTopicPage(
    url: string,
    topicId: string,
    userId: string | null,
    page: number,
    query: string | undefined,
    sort: ListSort
  ): Promise<CommunityForumTopicPageData>
  createCommunityForumTopic(change: CommunityForumTopicWrite): Promise<CommunityForumTopic>
  createCommunityForumReply(change: CommunityForumReplyWrite): Promise<CommunityForumReply>
  moderateCommunityForumTopic(change: CommunityForumTopicModerationWrite): Promise<CommunityForumTopic>
  deleteCommunityForumTopic(change: CommunityForumTopicRemoval): Promise<void>
  deleteCommunityForumReply(change: CommunityForumReplyRemoval): Promise<string>
}
