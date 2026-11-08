import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'
import { getProfileDirectoryPage } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import type { UseProfileCommunitiesPageResult } from './useProfileCommunitiesPage.types'

export function useProfileCommunitiesPage(): UseProfileCommunitiesPageResult {
  const { url } = useParams<{ url: string }>()
  const normalized = normalizeEntityUrl(url)
  const { page, pageSize, setPage } = useUrlPagination()

  const profileDirectoryQuery = useQuery({
    queryKey: queryKeys.profileDirectoryPage(
      normalized,
      'communities',
      page,
      pageSize
    ),
    queryFn: () =>
      getProfileDirectoryPage(normalized, 'communities', { page, pageSize }),
    enabled: Boolean(normalized),
    staleTime: 30 * 1000
  })
  const profile = profileDirectoryQuery.data?.profile
  const typeCompatibility = useProfileTypeCompatibility(
    profile?.type ?? 'social'
  )
  const communities =
    profileDirectoryQuery.data?.kind === 'communities'
      ? profileDirectoryQuery.data.communities.items
      : []
  const totalItems =
    profileDirectoryQuery.data?.kind === 'communities'
      ? profileDirectoryQuery.data.communities.totalItems
      : 0

  useEffect(() => {
    const result = profileDirectoryQuery.data
    if (result?.kind === 'communities' && result.communities.page !== page) {
      setPage(result.communities.page)
    }
  }, [profileDirectoryQuery.data, page, setPage])

  return {
    normalized,
    profileDirectoryQuery,
    profile,
    typeCompatibility,
    page,
    pageSize,
    setPage,
    communities,
    totalItems
  }
}
