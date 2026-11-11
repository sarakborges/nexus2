import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'
import { getProfileDirectoryPage, type ProfileDirectoryKind } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import type { UseProfileDirectoryPageResult } from './useProfileDirectoryPage.types'

export function useProfileDirectoryPage(
  kind: ProfileDirectoryKind
): UseProfileDirectoryPageResult {
  const { url } = useParams<{ url: string }>()
  const normalized = normalizeEntityUrl(url)
  const session = useAuthStore((state) => state.session)
  const isAuthInitialized = useAuthStore((state) => state.isInitialized)
  const viewerUserId = session?.user.id ?? null
  const currentProfileId = session?.user.currentProfile ?? null
  const pagination = useUrlPagination()
  const { page, pageSize, query, sort, setPage } = pagination

  const profileDirectoryQuery = useQuery({
    queryKey: queryKeys.profileDirectoryPage(
      normalized,
      kind,
      page,
      pageSize,
      viewerUserId,
      currentProfileId,
      query,
      sort
    ),
    queryFn: () =>
      getProfileDirectoryPage(normalized, kind, {
        page,
        pageSize,
        query,
        sort
      }),
    enabled: Boolean(normalized && isAuthInitialized),
    staleTime: 30 * 1000
  })

  const profile = profileDirectoryQuery.data?.profile
  const viewerRelationship =
    profileDirectoryQuery.data?.viewerRelationship ?? null
  const currentProfileType =
    profileDirectoryQuery.data?.currentProfileType ?? null
  const isChecking = Boolean(
    currentProfileId && profileDirectoryQuery.isLoading
  )
  const isCompatible =
    !currentProfileId ||
    (profileDirectoryQuery.isSuccess &&
      currentProfileType === (profile?.type ?? 'social'))
  const typeCompatibility = {
    isChecking,
    isCompatible,
    canInteract: !session || (isCompatible && !isChecking)
  }

  const resultPage =
    profileDirectoryQuery.data?.kind === 'friends'
      ? profileDirectoryQuery.data.friends.page
      : profileDirectoryQuery.data?.kind === 'communities'
        ? profileDirectoryQuery.data.communities.page
        : undefined

  useEffect(() => {
    if (
      profileDirectoryQuery.data?.kind === kind &&
      resultPage !== undefined &&
      resultPage !== page
    ) {
      setPage(resultPage)
    }
  }, [kind, profileDirectoryQuery.data?.kind, resultPage, page, setPage])

  return {
    ...pagination,
    normalized,
    isAuthInitialized,
    profileDirectoryQuery,
    profile,
    viewerRelationship,
    typeCompatibility,
    currentProfileId
  }
}
