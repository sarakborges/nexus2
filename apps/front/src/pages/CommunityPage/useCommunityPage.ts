import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import { getCommunityPage } from '@/Services/Community'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'
import type { UseCommunityPageResult } from './useCommunityPage.types'

export function useCommunityPage(): UseCommunityPageResult {
  const { url } = useParams<{ url: string }>()
  const navigate = useNavigate()
  const session = useAuthStore((state) => state.session)
  const isAuthInitialized = useAuthStore((state) => state.isInitialized)
  const viewerUserId = session?.user.id ?? null
  const currentProfileId = session?.user.currentProfile ?? null
  const requestedUrl = normalizeEntityUrl(url)

  const communityPageQuery = useQuery({
    queryKey: queryKeys.communityPage(requestedUrl, viewerUserId, currentProfileId),
    queryFn: () => getCommunityPage(requestedUrl),
    enabled: Boolean(requestedUrl && isAuthInitialized),
    staleTime: 30 * 1000
  })
  const page = communityPageQuery.data
  const community = page?.community
  const currentProfileType = page?.currentProfileType ?? null
  const isChecking = Boolean(currentProfileId && communityPageQuery.isLoading)
  const isCompatible = !currentProfileId || (communityPageQuery.isSuccess && currentProfileType === (community?.type ?? 'social'))
  const typeCompatibility = {
    isChecking,
    isCompatible,
    canInteract: !session || (isCompatible && !isChecking)
  }
  const members = page?.members.items ?? []
  const memberCount = page?.members.totalItems
  const forumTopics = page?.forumTopics.items ?? []
  const viewerRelationship = page?.viewerRelationship ?? null
  const forumAuthorsById = useMemo(
    () =>
      new Map(
        (page?.forumAuthors ?? []).map(
          (profile) => [profile.id, profile] as const
        )
      ),
    [page?.forumAuthors]
  )

  const openEditCommunity = () => {
    if (community && typeCompatibility.canInteract) {
      navigate(ROUTES.community + '/' + community.url + '/edit')
    }
  }

  return {
    requestedUrl,
    communityPageQuery,
    isAuthInitialized,
    community,
    viewerRelationship,
    typeCompatibility,
    canInteract: typeCompatibility.canInteract,
    canViewMembers: page?.canViewMembers ?? false,
    canEditCommunity: Boolean(page?.canEditCommunity && typeCompatibility.canInteract),
    openEditCommunity,
    pendingRequestCount: typeCompatibility.canInteract ? (page?.pendingRequestCount ?? 0) : 0,
    members,
    memberCount,
    forumTopics,
    forumAuthorsById
  }
}
