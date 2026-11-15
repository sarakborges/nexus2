import type { ListSort, PaginatedResult, SearchResultItem } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type UseSearchPageResult = {
  query: string
  searchQuery: UseQueryResult<PaginatedResult<SearchResultItem>>
  results: SearchResultItem[]
  totalItems: number
  page: number
  pageSize: number
  sort: ListSort
  setPage: (page: number) => void
  setSort: (sort: ListSort) => void
}
