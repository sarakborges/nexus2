import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { getCommunitiesPage } from '@/Services/Community'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import type { UseCommunitiesPageResult } from './useCommunitiesPage.types'

export function useCommunitiesPage(): UseCommunitiesPageResult {
  const session = useAuthStore((state) => state.session)
  const isAuthInitialized = useAuthStore((state) => state.isInitialized)
  const userId = session?.user.id ?? null
  const currentProfileId = session?.user.currentProfile ?? null
  const { page, pageSize, setPage, query, sort, setQuery, setSort } = useUrlPagination()

  const communitiesPageQuery = useQuery({
    queryKey: queryKeys.communitiesPage(
      userId ?? '',
      currentProfileId,
      page,
      pageSize,
      query,
      sort
    ),
    queryFn: () => getCommunitiesPage({ page, pageSize, query, sort }),
    enabled: Boolean(isAuthInitialized && userId),
    staleTime: 30 * 1000
  })
  const pageData = communitiesPageQuery.data
  const currentProfile = pageData?.currentProfile ?? null
  const communities = pageData?.communities.items ?? []
  const totalItems = pageData?.communities.totalItems ?? 0

  useEffect(() => {
    if (pageData?.communities && pageData.communities.page !== page) {
      setPage(pageData.communities.page)
    }
  }, [pageData?.communities, page, setPage])

  return {
    isAuthInitialized,
    communitiesPageQuery,
    currentProfile,
    page,
    pageSize,
    setPage,
    query,
    sort,
    setQuery,
    setSort,
    communities,
    totalItems
  }
}
