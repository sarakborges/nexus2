import type { ListSort } from '@nexus/common'

export type UseUrlPaginationResult = {
  page: number
  pageSize: number
  setPage: (page: number) => void
  query: string
  sort: ListSort
  setQuery: (query: string) => void
  setSort: (sort: ListSort) => void
}
