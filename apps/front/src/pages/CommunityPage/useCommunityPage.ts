import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'

import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { ROUTES } from '@/Constants/routes'
import { getCommunityPage } from '@/Services/Community'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'
import type { UseCommunityPageResult } from './useCommunityPage.types'

export function useCommunityPage(): UseCommunityPageResult {
  const { url } = useParams<{ url: string }>()
  const navigate = useNavigate()
  const viewerUserId = useAuthStore((state) => state.session?.user.id ?? null)
  const requestedUrl = normalizeEntityUrl(url)

  const communityPageQuery = useQuery({
    queryKey: queryKeys.communityPage(requestedUrl, viewerUserId),
    queryFn: () => getCommunityPage(requestedUrl),
    enabled: Boolean(requestedUrl),
    staleTime: 30 * 1000
  })
  const page = communityPageQuery.data
  const community = page?.community
  const typeCompatibility = useProfileTypeCompatibility(
    community?.type ?? 'social'
  )
  const members = page?.members.items ?? []
  const memberCount = page?.members.totalItems
  const forumTopics = page?.forumTopics.items ?? []
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
    if (community) {
      navigate(ROUTES.community + '/' + community.url + '/edit')
    }
  }

  return {
    requestedUrl,
    communityPageQuery,
    community,
    typeCompatibility,
    canInteract: typeCompatibility.canInteract,
    canViewMembers: page?.canViewMembers ?? false,
    canEditCommunity: page?.canEditCommunity ?? false,
    openEditCommunity,
    pendingRequestCount: page?.pendingRequestCount ?? 0,
    members,
    memberCount,
    forumTopics,
    forumAuthorsById
  }
}
