import { useQuery } from '@tanstack/react-query'

import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'

import { useCommunityByUrl } from '@/Hooks/Community'
import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'

import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { ROUTES } from '@/Constants/routes'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { getCommunityForumTopics } from '@/Services/CommunityForum'
import { useCommunityForumAccess } from '@/Hooks/Community'
import { useProfileByUrl, useProfilesByIds } from '@/Hooks/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import type { UseCommunityForumPageResult } from './useCommunityForumPage.types'

export function useCommunityForumPage(): UseCommunityForumPageResult {
  const { url } = useParams<{ url: string }>()
  const navigate = useNavigate()
  const session = useAuthStore((state) => state.session)
  const profileIds = session?.user.profiles ?? []
  const currentProfileId = session?.user.currentProfile ?? null
  const normalized = normalizeEntityUrl(url)
  const { page, pageSize, setPage } = useUrlPagination()

  const communityQuery = useCommunityByUrl({
    url: normalized,
    viewerUserId: session?.user.id ?? null
  })
  const community = communityQuery.data
  const typeCompatibility = useProfileTypeCompatibility(
    community?.type ?? 'social'
  )
  const {
    relationshipsQuery,
    ownedProfilesQuery,
    canPublish
  } = useCommunityForumAccess({
    communityId: community?.id ?? null,
    communityType: community?.type ?? null,
    viewerUserId: session?.user.id ?? null,
    profileIds,
    currentProfileId,
    relationshipsEnabled: Boolean(session?.user.id)
  })

  const openCreateTopic = () => {
    if (community) {
      navigate(ROUTES.community + '/' + community.url + '/forum/new')
    }
  }

  const topicsQuery = useQuery({
    queryKey: queryKeys.communityForumTopics(
      community?.id ?? '',
      page,
      pageSize,
      session?.user.id ?? null
    ),
    queryFn: () => getCommunityForumTopics(community!.id, { page, pageSize }),
    enabled: Boolean(community?.id)
  })
  const topics = useMemo(
    () => topicsQuery.data?.items ?? [],
    [topicsQuery.data?.items]
  )
  const authorIds = useMemo(
    () => [...new Set(topics.map((topic) => topic.profileId))].sort(),
    [topics]
  )
  const {
    profilesQuery: authorsQuery,
    profilesById: authorsById
  } = useProfilesByIds(authorIds)


  return {
    normalized,
    session,
    page,
    pageSize,
    setPage,
    communityQuery,
    community,
    typeCompatibility,
    relationshipsQuery,
    ownedProfilesQuery,
    canPublish,
    openCreateTopic,
    topicsQuery,
    topics,
    authorsQuery,
    authorsById
  }
}
