import type {
  CommunityForumTopicPageData,
  PaginationParams
} from '@nexus/common'

import { api } from '../Http/api'

export async function getCommunityForumTopicPage(
  url: string,
  topicId: string,
  params: PaginationParams
): Promise<CommunityForumTopicPageData> {
  const { data } = await api.get<CommunityForumTopicPageData>(
    `/communities/by-url/${encodeURIComponent(url)}/forum/topics/${encodeURIComponent(topicId)}/page`,
    { params }
  )
  return data
}
