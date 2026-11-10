import type { CommunityPageData } from '@nexus/common'

import { api } from '../Http/api'

export async function getCommunityPage(url: string): Promise<CommunityPageData> {
  const { data } = await api.get<CommunityPageData>(
    `/communities/by-url/${encodeURIComponent(url)}/page`
  )
  return data
}
