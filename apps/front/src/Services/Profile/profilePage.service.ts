import type { ProfilePageData } from '@nexus/common'

import { api } from '../Http/api'

export async function getProfilePage(url: string): Promise<ProfilePageData> {
  const { data } = await api.get<ProfilePageData>(
    `/profiles/by-url/${encodeURIComponent(url)}/page`
  )
  return data
}
