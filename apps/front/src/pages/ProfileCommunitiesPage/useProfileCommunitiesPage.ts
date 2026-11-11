import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'
import { getProfileDirectoryPage } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import type { UseProfileCommunitiesPageResult } from './useProfileCommunitiesPage.types'

export function useProfileCommunitiesPage(): UseProfileCommunitiesPageResult {
  const { url } = useParams<{ url: string }>()
  const normalized = normalizeEntityUrl(url)
  const session = useAuthStore((state) => state.session)
  const isAuthInitialized = useAuthStore((state) => state.isInitialized)
  const viewerUserId = session?.user.id ?? null
  const currentProfileId = session?.user.currentProfile ?? null
  const { page, pageSize, setPage, query, sort, setQuery, setSort } = useUrlPagination()

  const profileDirectoryQuery = useQuery({
    queryKey: queryKeys.profileDirectoryPage(
      normalized,
      'communities',
      page,
      pageSize,
      viewerUserId,
      currentProfileId,
      query,
      sort
    ),
    queryFn: () =>
      getProfileDirectoryPage(normalized, 'communities', { page, pageSize, query, sort }),
    enabled: Boolean(normalized && isAuthInitialized),
    staleTime: 30 * 1000
  })
  const profile = profileDirectoryQuery.data?.profile
  const viewerRelationship = profileDirectoryQuery.data?.viewerRelationship ?? null
  const currentProfileType = profileDirectoryQuery.data?.currentProfileType ?? null
  const isChecking = Boolean(currentProfileId && profileDirectoryQuery.isLoading)
  const isCompatible = !currentProfileId || (profileDirectoryQuery.isSuccess && currentProfileType === (profile?.type ?? 'social'))
  const typeCompatibility = {
    isChecking,
    isCompatible,
    canInteract: !session || (isCompatible && !isChecking)
  }
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
    isAuthInitialized,
    profileDirectoryQuery,
    profile,
    viewerRelationship,
    typeCompatibility,
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
