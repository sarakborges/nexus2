import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'
import { getProfileDirectoryPage } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import type { UseProfileFriendsPageResult } from './useProfileFriendsPage.types'

export function useProfileFriendsPage(): UseProfileFriendsPageResult {
  const { url } = useParams<{ url: string }>()
  const normalized = normalizeEntityUrl(url)
  const { page, pageSize, setPage } = useUrlPagination()

  const profileDirectoryQuery = useQuery({
    queryKey: queryKeys.profileDirectoryPage(
      normalized,
      'friends',
      page,
      pageSize
    ),
    queryFn: () =>
      getProfileDirectoryPage(normalized, 'friends', { page, pageSize }),
    enabled: Boolean(normalized),
    staleTime: 30 * 1000
  })
  const profile = profileDirectoryQuery.data?.profile
  const typeCompatibility = useProfileTypeCompatibility(
    profile?.type ?? 'social'
  )
  const friends =
    profileDirectoryQuery.data?.kind === 'friends'
      ? profileDirectoryQuery.data.friends.items
      : []
  const totalItems =
    profileDirectoryQuery.data?.kind === 'friends'
      ? profileDirectoryQuery.data.friends.totalItems
      : 0

  useEffect(() => {
    const result = profileDirectoryQuery.data
    if (result?.kind === 'friends' && result.friends.page !== page) {
      setPage(result.friends.page)
    }
  }, [profileDirectoryQuery.data, page, setPage])

  return {
    normalized,
    profileDirectoryQuery,
    profile,
    typeCompatibility,
    canInteract: typeCompatibility.canInteract,
    page,
    pageSize,
    setPage,
    friends,
    totalItems
  }
}
