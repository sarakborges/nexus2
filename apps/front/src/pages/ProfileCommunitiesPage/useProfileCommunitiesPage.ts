import { useQuery } from '@tanstack/react-query'

import { useEffect } from 'react'
import { useParams } from 'react-router'

import { useProfileByUrl } from '@/Hooks/Profile'
import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'


import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { getProfileCommunities } from '@/Services/Community'
import type { UseProfileCommunitiesPageResult } from './useProfileCommunitiesPage.types'
import { queryKeys } from '@/Services/Query/queryKeys'

export function useProfileCommunitiesPage(): UseProfileCommunitiesPageResult {
  const { url } = useParams<{ url: string }>()
  const normalized = normalizeEntityUrl(url)
  const profileQuery = useProfileByUrl({ url: normalized })
  const profile = profileQuery.data
  const typeCompatibility = useProfileTypeCompatibility(
    profile?.type ?? 'social'
  )
  const { page, pageSize, setPage } = useUrlPagination()
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
