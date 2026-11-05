import { useQuery } from '@tanstack/react-query'

import { useMemo } from 'react'
import { useParams } from 'react-router'

import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { getCommunityByUrl } from '@/Services/Community'
import { getCommunityForumTopics } from '@/Services/CommunityForum'
import { getCommunityRelationships } from '@/Services/CommunityRelationship'
import { getProfilesByIds } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'

export function useCommunityForumPage() {
  const { url } = useParams<{ url: string }>()
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
  const ownedProfilesQuery = useQuery({
    queryKey: queryKeys.profiles.byIds(profileIds),
    queryFn: () => getProfilesByIds(profileIds),
    enabled: profileIds.length > 0
  })
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
  const authorsQuery = useQuery({
    queryKey: queryKeys.profiles.byIds(authorIds),
    queryFn: () => getProfilesByIds(authorIds),
    enabled: authorIds.length > 0
  })
  const authorsById = useMemo(
    () =>
      new Map(
        (authorsQuery.data ?? []).map(
          (profile) => [profile.id, profile] as const
        )
      ),
    [authorsQuery.data]
  )


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
    topicsQuery,
    topics,
    authorsQuery,
    authorsById
  }
}
