import { useQuery } from '@tanstack/react-query'
import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'

import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'

import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { useCommunityAccess } from '@/Hooks/Community'
import { ROUTES } from '@/Constants/routes'
import { getCommunityByUrl } from '@/Services/Community'
import { getCommunityForumTopics } from '@/Services/CommunityForum'
import {
  getCommunityMembers,
  getPendingCommunityMembers
} from '@/Services/CommunityRelationship'
import { useProfilesByIds } from '@/Hooks/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import type { UseCommunityPageResult } from './useCommunityPage.types'

export function useCommunityPage(): UseCommunityPageResult {
  const { url } = useParams<{ url: string }>()
  const navigate = useNavigate()
  const session = useAuthStore((state) => state.session)
  const currentProfileId = session?.user.currentProfile ?? null
  const requestedUrl = normalizeEntityUrl(url)

  const communityQuery = useQuery({
    queryKey: queryKeys.communities.byUrl(requestedUrl, session?.user.id ?? null),
    queryFn: () => getCommunityByUrl(requestedUrl),
    enabled: Boolean(requestedUrl)
  })
  const community = communityQuery.data
  const typeCompatibility = useProfileTypeCompatibility(
    community?.type ?? 'social'
  )
  const {
    relationshipsQuery,
    relationships,
    isOwner,
    managementRelationship
  } = useCommunityAccess({
    communityId: community?.id ?? null,
    viewerUserId: session?.user.id ?? null,
    profileIds: session?.user.profiles ?? []
  })
  const privateMembership = relationships.some((record) =>
    ['owner', 'moderator', 'connection'].includes(record.type)
  )
  const canViewMembers = community?.privacy !== 'private' || privateMembership
  const canEditCommunity = isOwner
  const pendingActor = managementRelationship
  const pendingRequestsQuery = useQuery({
    queryKey: queryKeys.pendingCommunityMembers(
      community?.id ?? '',
      pendingActor?.profiles[0] ?? '',
      1,
      1,
      session?.user.id ?? null
    ),
    queryFn: () =>
      getPendingCommunityMembers(community!.id, pendingActor!.profiles[0], {
        page: 1,
        pageSize: 1
      }),
    enabled: Boolean(community?.id && pendingActor)
  })
  const membersQuery = useQuery({
    queryKey: queryKeys.communityMembers(
      community?.id ?? '',
      'all',
      1,
      16,
      currentProfileId ?? undefined,
      session?.user.id ?? null
    ),
    queryFn: () =>
      getCommunityMembers(
        community!.id,
        'all',
        { page: 1, pageSize: 16 },
        currentProfileId ?? undefined
      ),
    enabled: Boolean(
      community?.id && relationshipsQuery.isSuccess && canViewMembers
    )
  })

  const members = membersQuery.data?.items ?? []
  const memberCount = membersQuery.data?.totalItems
  const openEditCommunity = () => {
    if (community) {
      navigate(ROUTES.community + '/' + community.url + '/edit')
    }
  }

  const forumTopicsQuery = useQuery({
    queryKey: queryKeys.communityForumTopics(community?.id ?? '', 1, 20, session?.user.id ?? null),
    queryFn: () =>
      getCommunityForumTopics(community!.id, { page: 1, pageSize: 20 }),
    enabled: Boolean(community?.id && relationshipsQuery.isSuccess)
  })
  const forumTopics = useMemo(
    () => forumTopicsQuery.data?.items ?? [],
    [forumTopicsQuery.data?.items]
  )
  const forumAuthorIds = useMemo(
    () => [...new Set(forumTopics.map((topic) => topic.profileId))].sort(),
    [forumTopics]
  )
  const {
    profilesQuery: forumAuthorsQuery,
    profilesById: forumAuthorsById
  } = useProfilesByIds(forumAuthorIds)

  return {
    requestedUrl,
    communityQuery,
    community,
    typeCompatibility,
    canInteract: typeCompatibility.canInteract,
    relationshipsQuery,
    canViewMembers,
    canEditCommunity,
    openEditCommunity,
    members,
    memberCount,
    pendingActor,
    pendingRequestsQuery,
    membersQuery,
    forumTopicsQuery,
    forumTopics,
    forumAuthorIds,
    forumAuthorsQuery,
    forumAuthorsById
  }
}
