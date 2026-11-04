import { api } from '../Http/api'
import type {
  CommunityForumReply,
  CommunityForumTopic,
  CommunityForumTopicDetail,
  CommunityForumTopicSummary,
  PaginatedResult,
  PaginationParams
} from '@nexus/common'

export async function getCommunityForumTopics(
  communityId: string,
  params: PaginationParams = {}
): Promise<PaginatedResult<CommunityForumTopicSummary>> {
  const { data } = await api.get<PaginatedResult<CommunityForumTopicSummary>>(
    `/communities/${encodeURIComponent(communityId)}/forum/topics`,
    { params }
  )
  return data
}
export async function getCommunityForumTopic(
  communityId: string,
  topicId: string,
  params: PaginationParams = {}
): Promise<CommunityForumTopicDetail> {
  const { data } = await api.get<CommunityForumTopicDetail>(
    `/communities/${encodeURIComponent(communityId)}/forum/topics/${encodeURIComponent(topicId)}`,
    { params }
  )
  return data
}
export async function createCommunityForumTopic(
  communityId: string,
  profileId: string,
  title: string,
  content: string
): Promise<CommunityForumTopic> {
  const { data } = await api.post<CommunityForumTopic>(
    `/communities/${encodeURIComponent(communityId)}/forum/topics`,
    { profileId, title, content }
  )
  return data
}
export async function createCommunityForumReply(
  communityId: string,
  topicId: string,
  profileId: string,
  content: string
): Promise<CommunityForumReply> {
  const { data } = await api.post<CommunityForumReply>(
    `/communities/${encodeURIComponent(communityId)}/forum/topics/${encodeURIComponent(topicId)}/replies`,
    { profileId, content }
  )
  return data
}
export async function moderateCommunityForumTopic(
  communityId: string,
  topicId: string,
  profileId: string,
  changes: { isPinned?: boolean; isLocked?: boolean }
): Promise<CommunityForumTopic> {
  const { data } = await api.put<CommunityForumTopic>(
    `/communities/${encodeURIComponent(communityId)}/forum/topics/${encodeURIComponent(topicId)}/moderation`,
    { profileId, ...changes }
  )
  return data
}
export async function deleteCommunityForumTopic(
  communityId: string,
  topicId: string,
  profileId: string
): Promise<void> {
  await api.delete(
    `/communities/${encodeURIComponent(communityId)}/forum/topics/${encodeURIComponent(topicId)}`,
    { data: { profileId } }
  )
}
export async function deleteCommunityForumReply(
  communityId: string,
  replyId: string,
  profileId: string
): Promise<void> {
  await api.delete(
    `/communities/${encodeURIComponent(communityId)}/forum/replies/${encodeURIComponent(replyId)}`,
    { data: { profileId } }
  )
}
