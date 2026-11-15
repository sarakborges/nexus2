import { useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'

import type { SearchScope } from '@nexus/common'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { queryKeys } from '@/Services/Query/queryKeys'
import { searchEntities } from '@/Services/Search/search.service'
import type { UseSearchPageResult } from './useSearchPage.types'

export function useSearchPage(): UseSearchPageResult {
  const [searchParams] = useSearchParams()
  const query = (searchParams.get('query') ?? '').trim()
  const requestedScope = searchParams.get('scope')
  const scope: SearchScope =
    requestedScope === 'profiles' || requestedScope === 'communities'
      ? requestedScope
      : 'all'
  const { page, pageSize, setPage, sort, setSort } = useUrlPagination()

  const searchQuery = useQuery({
    queryKey: queryKeys.search(query, scope, sort, page, pageSize),
    queryFn: () => searchEntities({ query, scope, page, pageSize, sort }),
    enabled: true
  })

  return {
    query,
    searchQuery,
    results: searchQuery.data?.items ?? [],
    totalItems: searchQuery.data?.totalItems ?? 0,
    page: searchQuery.data?.page ?? page,
    pageSize: searchQuery.data?.pageSize ?? pageSize,
    sort,
    setPage,
    setSort
  }
}
