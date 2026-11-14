import type { ListSort } from '@nexus/common'

export type PaginatedListControlsProps = {
  query: string
  sort: ListSort
  onQueryChange: (query: string) => void
  onSortChange: (sort: ListSort) => void
}
