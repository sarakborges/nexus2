import { useQuery } from '@tanstack/react-query'

import { useEffect } from 'react'
import { useParams } from 'react-router'

import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { getProfileByUrl } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { getProfileFriends } from '@/Services/Relationship'

export function useProfileFriendsPage() {
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
  const canInteract =
    typeCompatibility.isCompatible && !typeCompatibility.isChecking
  const { page, pageSize, setPage } = useUrlPagination()
  const friendsQuery = useQuery({
    queryKey: queryKeys.relationships.friends(
      profile?.id ?? '',
      page,
      pageSize
    ),
    queryFn: () => getProfileFriends(profile!.id, { page, pageSize }),
    enabled: Boolean(profile?.id)
  })
  const friends = friendsQuery.data?.items ?? []
  const totalItems = friendsQuery.data?.totalItems ?? 0

  useEffect(() => {
    if (friendsQuery.data && friendsQuery.data.page !== page)
      setPage(friendsQuery.data.page)
  }, [friendsQuery.data, page, setPage])

  return {
    normalized,
    profileQuery,
    profile,
    typeCompatibility,
    canInteract,
    page,
    pageSize,
    setPage,
    friendsQuery,
    friends,
    totalItems
  }
}
