import type {
  PaginationParams,
  ProfileMessagesPageData
} from '@nexus/common'

import { api } from '../Http/api'

export async function getProfileMessagesPage(
  url: string,
  params: PaginationParams
): Promise<ProfileMessagesPageData> {
  const { data } = await api.get<ProfileMessagesPageData>(
    `/profiles/by-url/${encodeURIComponent(url)}/messages/page`,
    { params }
  )
  return data
}
