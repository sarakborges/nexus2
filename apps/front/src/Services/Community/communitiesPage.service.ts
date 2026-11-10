import type { CommunitiesPageData, PaginationParams } from '@nexus/common'

import { api } from '../Http/api'

export async function getCommunitiesPage(
  params: PaginationParams = {}
): Promise<CommunitiesPageData> {
  const { data } = await api.get<CommunitiesPageData>('/communities/page', {
    params
  })
  return data
}
