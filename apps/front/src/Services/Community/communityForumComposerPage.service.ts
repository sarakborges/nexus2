import type { CommunityForumComposerPageData } from '@nexus/common'

import { api } from '../Http/api'

export async function getCommunityForumComposerPage(
  url: string
): Promise<CommunityForumComposerPageData> {
  const { data } = await api.get<CommunityForumComposerPageData>(
    `/communities/by-url/${encodeURIComponent(url)}/forum/composer-page`
  )
  return data
}
