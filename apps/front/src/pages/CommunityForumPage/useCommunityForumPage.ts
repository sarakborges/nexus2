import { useQuery } from '@tanstack/react-query'

import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'

import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { ROUTES } from '@/Constants/routes'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { getCommunityByUrl } from '@/Services/Community'
import { getCommunityForumTopics } from '@/Services/CommunityForum'
import { getCommunityRelationships } from '@/Services/CommunityRelationship'
import { useProfilesByIds } from '@/Hooks/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import type { UseCommunityForumPageResult } from './useCommunityForumPage.types'

export function useCommunityForumPage(): UseCommunityForumPageResult {
  const { url } = useParams<{ url: string }>()
  const navigate = useNavigate()
  const session = useAuthStore((state) => state.session)
  const profileIds = session?.user.profiles ?? []
  const currentProfileId = session?.user.currentProfile ?? null
  const normalized = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const { page, pageSize, setPage } = useUrlPagination()

  const communityQuery = useQuery({
    queryKey: queryKeys.communities.byUrl(normalized, session?.user.id ?? null),
    queryFn: () => getCommunityByUrl(normalized),
    enabled: Boolean(normalized)
  })
  const community = communityQuery.data
  const typeCompatibility = useProfileTypeCompatibility(
    community?.type ?? 'social'
  )
  const relationshipsQuery = useQuery({
    queryKey: queryKeys.communityRelationships(
      community?.id ?? '',
      session?.user.id ?? null
    ),
    queryFn: () => getCommunityRelationships(community!.id),
    enabled: Boolean(community?.id && session?.user.id)
  })
  const { profilesQuery: ownedProfilesQuery } = useProfilesByIds(profileIds)
  const rolesByProfileId = new Map(
    (relationshipsQuery.data ?? [])
      .filter((record) => record.profiles[1] === community?.id)
      .map((record) => [record.profiles[0], record.type] as const)
  )
  const eligibleProfiles = (ownedProfilesQuery.data ?? []).filter(
    (profile) =>
      profile.type === community?.type &&
      ['owner', 'moderator', 'connection'].includes(
        rolesByProfileId.get(profile.id) ?? ''
      )
  )
  const forumProfile =
    eligibleProfiles.find((profile) => profile.id === currentProfileId) ??
    eligibleProfiles.find(
      (profile) => rolesByProfileId.get(profile.id) === 'owner'
    ) ??
    eligibleProfiles.find(
      (profile) => rolesByProfileId.get(profile.id) === 'moderator'
    ) ??
    eligibleProfiles[0] ??
    null
  const canPublish = Boolean(forumProfile)

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
