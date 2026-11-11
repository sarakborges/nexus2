import type { CommunityForumPageData, PaginationParams } from '@nexus/common'

import { api } from '../Http/api'

export async function getCommunityForumPage(
  url: string,
  params: PaginationParams
): Promise<CommunityForumPageData> {
  const { data } = await api.get<CommunityForumPageData>(
    `/communities/by-url/${encodeURIComponent(url)}/forum/page`,
    { params }
  )
  return data
}
