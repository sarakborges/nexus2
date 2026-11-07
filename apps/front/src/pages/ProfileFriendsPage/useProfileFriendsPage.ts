import { useQuery } from '@tanstack/react-query'

import { useEffect } from 'react'

import { useProfileDirectoryContext } from '@/Hooks/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { getProfileFriends } from '@/Services/Relationship'
import type { UseProfileFriendsPageResult } from './useProfileFriendsPage.types'

export function useProfileFriendsPage(): UseProfileFriendsPageResult {
  const {
    normalized,
    profileQuery,
    profile,
    typeCompatibility,
    page,
    pageSize,
    setPage
  } = useProfileDirectoryContext()
  const canInteract = typeCompatibility.canInteract

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
