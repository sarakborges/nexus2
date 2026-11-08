import type { CommunityMembersPageData, PaginationParams } from '@nexus/common'

import { api } from '../Http/api'

export type CommunityMembersPageParams = PaginationParams & {
  tab: 'all' | 'staff' | 'banned'
  pendingPage: number
}

export async function getCommunityMembersPage(
  url: string,
  params: CommunityMembersPageParams
): Promise<CommunityMembersPageData> {
  const { data } = await api.get<CommunityMembersPageData>(
    `/communities/by-url/${encodeURIComponent(url)}/members/page`,
    { params }
  )
  return data
}
