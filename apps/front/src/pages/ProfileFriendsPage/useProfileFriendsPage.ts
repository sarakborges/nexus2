import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'
import { getProfileDirectoryPage } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import type { UseProfileFriendsPageResult } from './useProfileFriendsPage.types'

export function useProfileFriendsPage(): UseProfileFriendsPageResult {
  const { url } = useParams<{ url: string }>()
  const normalized = normalizeEntityUrl(url)
  const session = useAuthStore((state) => state.session)
  const isAuthInitialized = useAuthStore((state) => state.isInitialized)
  const viewerUserId = session?.user.id ?? null
  const currentProfileId = session?.user.currentProfile ?? null
  const { page, pageSize, setPage } = useUrlPagination()

  const profileDirectoryQuery = useQuery({
    queryKey: queryKeys.profileDirectoryPage(
      normalized,
      'friends',
      page,
      pageSize,
      viewerUserId,
      currentProfileId
    ),
    queryFn: () =>
      getProfileDirectoryPage(normalized, 'friends', { page, pageSize }),
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
  const friends =
    profileDirectoryQuery.data?.kind === 'friends'
      ? profileDirectoryQuery.data.friends.items
      : []
  const totalItems =
    profileDirectoryQuery.data?.kind === 'friends'
      ? profileDirectoryQuery.data.friends.totalItems
      : 0
  const friendRelationshipsByProfileId = useMemo(() => {
    const relationships = profileDirectoryQuery.data?.kind === 'friends'
      ? profileDirectoryQuery.data.friendRelationships
      : []
    return new Map(relationships.map((relationship) => {
      const friendId = relationship.profiles.find((id) => id !== currentProfileId) ?? ''
      return [friendId, relationship] as const
    }))
  }, [profileDirectoryQuery.data, currentProfileId])

  useEffect(() => {
    const result = profileDirectoryQuery.data
    if (result?.kind === 'friends' && result.friends.page !== page) {
      setPage(result.friends.page)
    }
  }, [profileDirectoryQuery.data, page, setPage])

  return {
    normalized,
    isAuthInitialized,
    profileDirectoryQuery,
    profile,
    viewerRelationship,
    friendRelationshipsByProfileId,
    typeCompatibility,
    canInteract: typeCompatibility.canInteract,
    page,
    pageSize,
    setPage,
    friends,
    totalItems
  }
}
