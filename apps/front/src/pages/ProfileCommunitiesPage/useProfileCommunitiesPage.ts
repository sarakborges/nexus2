import { useQuery } from '@tanstack/react-query'

import { useEffect } from 'react'

import { useProfileDirectoryContext } from '@/Hooks/Profile'
import { getProfileCommunities } from '@/Services/Community'
import { queryKeys } from '@/Services/Query/queryKeys'
import type { UseProfileCommunitiesPageResult } from './useProfileCommunitiesPage.types'

export function useProfileCommunitiesPage(): UseProfileCommunitiesPageResult {
  const {
    normalized,
    profileQuery,
    profile,
    typeCompatibility,
    page,
    pageSize,
    setPage
  } = useProfileDirectoryContext()

  const communitiesQuery = useQuery({
    queryKey: queryKeys.communities.byProfile(
      profile?.id ?? '',
      page,
      pageSize
    ),
    queryFn: () => getProfileCommunities(profile!.id, { page, pageSize }),
    enabled: Boolean(profile?.id)
  })
  const communities = communitiesQuery.data?.items ?? []
  const totalItems = communitiesQuery.data?.totalItems ?? 0

  useEffect(() => {
    if (communitiesQuery.data && communitiesQuery.data.page !== page)
      setPage(communitiesQuery.data.page)
  }, [communitiesQuery.data, page, setPage])

  return {
    normalized,
    profileQuery,
    profile,
    typeCompatibility,
    page,
    pageSize,
    setPage,
    communitiesQuery,
    communities,
    totalItems
  }
}
