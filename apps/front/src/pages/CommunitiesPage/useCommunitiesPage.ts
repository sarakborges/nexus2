import { useQuery } from '@tanstack/react-query'

import { useEffect } from 'react'

import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { getCommunities } from '@/Services/Community'
import { getProfilesByIds } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import type { UseCommunitiesPageResult } from './useCommunitiesPage.types'

export function useCommunitiesPage(): UseCommunitiesPageResult {
  const session = useAuthStore((state) => state.session)
  const profileIds = session?.user.profiles ?? []
  const currentProfileId = session?.user.currentProfile ?? null
  const profilesQuery = useQuery({
    queryKey: queryKeys.profiles.byIds(profileIds),
    queryFn: () => getProfilesByIds(profileIds),
    enabled: profileIds.length > 0
  })
  const currentProfile =
    profilesQuery.data?.find((profile) => profile.id === currentProfileId) ??
    profilesQuery.data?.[0] ??
    null
  const { page, pageSize, setPage } = useUrlPagination()
  const communitiesQuery = useQuery({
    queryKey: queryKeys.communities.list(page, pageSize),
    queryFn: () => getCommunities({ page, pageSize })
  })
  const communities = communitiesQuery.data?.items ?? []
  const totalItems = communitiesQuery.data?.totalItems ?? 0

  useEffect(() => {
    if (communitiesQuery.data && communitiesQuery.data.page !== page)
      setPage(communitiesQuery.data.page)
  }, [communitiesQuery.data, page, setPage])

  return {
    profilesQuery,
    currentProfile,
    page,
    pageSize,
    setPage,
    communitiesQuery,
    communities,
    totalItems
  }
}
