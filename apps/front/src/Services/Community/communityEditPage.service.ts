import type { CommunityEditPageData } from '@nexus/common'

import { api } from '../Http/api'

export async function getCommunityEditPage(
  url: string
): Promise<CommunityEditPageData> {
  const { data } = await api.get<CommunityEditPageData>(
    `/communities/by-url/${encodeURIComponent(url)}/edit/page`
  )
  return data
}
