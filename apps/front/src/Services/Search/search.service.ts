import type { PaginatedResult, SearchResultItem, SearchScope } from '@nexus/common'
import { api } from '@/Services/Http/api'

export type SearchParams = {
  query: string
  scope: SearchScope
  page: number
  pageSize: number
}

export async function searchEntities(
  params: SearchParams
): Promise<PaginatedResult<SearchResultItem>> {
  const { data } = await api.get<PaginatedResult<SearchResultItem>>('/search', {
    params
  })
  return data
}
