import type {
  PaginationParams,
  ProfileDirectoryPageData
} from '@nexus/common'

import { api } from '../Http/api'

export type ProfileDirectoryKind = 'friends' | 'communities'

export async function getProfileDirectoryPage(
  url: string,
  kind: ProfileDirectoryKind,
  params: PaginationParams
): Promise<ProfileDirectoryPageData> {
  const { data } = await api.get<ProfileDirectoryPageData>(
    `/profiles/by-url/${encodeURIComponent(url)}/directory/${kind}/page`,
    { params }
  )
  return data
}
