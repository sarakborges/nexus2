import { useQuery } from '@tanstack/react-query'

import { useEffect } from 'react'
import { useParams } from 'react-router'

import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { getProfileCommunities } from '@/Services/Community'
import { getProfileByUrl } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'

export function useProfileCommunitiesPage() {
  const { url } = useParams<{ url: string }>()
  const normalized = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const profileQuery = useQuery({
    queryKey: queryKeys.profiles.byUrl(normalized),
    queryFn: () => getProfileByUrl(normalized),
    enabled: Boolean(normalized)
  })
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
