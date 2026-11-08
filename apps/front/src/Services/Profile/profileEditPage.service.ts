import type { ProfileEditPageData } from '@nexus/common'

import { api } from '../Http/api'

export async function getProfileEditPage(
  url: string
): Promise<ProfileEditPageData> {
  const { data } = await api.get<ProfileEditPageData>(
    `/profiles/by-url/${encodeURIComponent(url)}/edit/page`
  )
  return data
}
