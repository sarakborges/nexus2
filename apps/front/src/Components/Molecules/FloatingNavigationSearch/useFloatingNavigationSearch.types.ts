import type { FormEventHandler } from 'react'
import type { SearchScope } from '@nexus/common'

export type UseFloatingNavigationSearchResult = {
  searchText: string
  searchScope: SearchScope
  setSearchText: (text: string) => void
  setSearchScope: (scope: SearchScope) => void
  handleSearch: FormEventHandler<HTMLFormElement>
}
