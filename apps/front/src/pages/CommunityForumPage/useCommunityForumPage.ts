import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { getCommunityForumPage } from '@/Services/CommunityForum'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'
import type { UseCommunityForumPageResult } from './useCommunityForumPage.types'

export function useCommunityForumPage(): UseCommunityForumPageResult {
  const { url } = useParams<{ url: string }>()
  const navigate = useNavigate()
  const session = useAuthStore((state) => state.session)
  const isAuthInitialized = useAuthStore((state) => state.isInitialized)
  const viewerUserId = session?.user.id ?? null
  const currentProfileId = session?.user.currentProfile ?? null
  const normalized = normalizeEntityUrl(url)
  const { page, pageSize, setPage } = useUrlPagination()

  const forumPageQuery = useQuery({
    queryKey: queryKeys.communityForumPage(
      normalized,
      page,
      pageSize,
      viewerUserId,
      currentProfileId
    ),
    queryFn: () => getCommunityForumPage(normalized, { page, pageSize }),
    enabled: Boolean(normalized && isAuthInitialized),
    staleTime: 30 * 1000
  })
  const community = forumPageQuery.data?.community
  const currentProfileType = forumPageQuery.data?.currentProfileType ?? null
  const isChecking = Boolean(currentProfileId && forumPageQuery.isLoading)
  const isCompatible = !currentProfileId || (forumPageQuery.isSuccess && currentProfileType === (community?.type ?? 'social'))
  const typeCompatibility = {
    isChecking,
    isCompatible,
    canInteract: !session || (isCompatible && !isChecking)
  }
  const viewerRelationship = forumPageQuery.data?.viewerRelationship ?? null
  const topics = forumPageQuery.data?.topics.items ?? []
  const authorsById = useMemo(
    () =>
      new Map(
        (forumPageQuery.data?.authors ?? []).map(
          (profile) => [profile.id, profile] as const
        )
      ),
    [forumPageQuery.data?.authors]
  )

  const openCreateTopic = () => {
    if (community) {
      navigate(ROUTES.community + '/' + community.url + '/forum/new')
    }
  }

  return {
    normalized,
    isAuthInitialized,
    session,
    page,
    pageSize,
    setPage,
    forumPageQuery,
    community,
    viewerRelationship,
    typeCompatibility,
    canReadForum: forumPageQuery.data?.canReadForum ?? false,
    canPublish: Boolean(forumPageQuery.data?.canPublish && typeCompatibility.canInteract),
    openCreateTopic,
    topics,
    authorsById
  }
}
