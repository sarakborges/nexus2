import type { ListSort, SearchResultItem } from '@nexus/common'

export type SearchResultsPanelProps = {
  query: string
  isLoading: boolean
  isError: boolean
  isSuccess: boolean
  results: SearchResultItem[]
  totalItems: number
  page: number
  pageSize: number
  sort: ListSort
  onSortChange: (sort: ListSort) => void
  onPageChange: (page: number) => void
  onRetry: () => void
}
