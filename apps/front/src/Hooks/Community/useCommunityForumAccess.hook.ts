import type { CommunityRelationship } from '@nexus/common'
import { useQuery } from '@tanstack/react-query'

import { useMemo } from 'react'

import { useProfilesByIds } from '@/Hooks/Profile'
import { getCommunityRelationships } from '@/Services/CommunityRelationship'
import { queryKeys } from '@/Services/Query/queryKeys'
import type {
  UseCommunityForumAccessOptions,
  UseCommunityForumAccessResult
} from './useCommunityForumAccess.types'

const PUBLISH_ROLES: CommunityRelationship['type'][] = [
  'owner',
  'moderator',
  'connection'
]

export function useCommunityForumAccess({
  communityId,
  communityType,
  viewerUserId,
  profileIds,
  currentProfileId,
  relationshipsEnabled = true
}: UseCommunityForumAccessOptions): UseCommunityForumAccessResult {
  const relationshipsQuery = useQuery({
    queryKey: queryKeys.communityRelationships(communityId ?? '', viewerUserId),
    queryFn: () => getCommunityRelationships(communityId!),
    enabled: Boolean(communityId && relationshipsEnabled)
  })
  const { profilesQuery: ownedProfilesQuery } = useProfilesByIds(profileIds)

  const rolesByProfileId = useMemo(
    () =>
      new Map(
        (relationshipsQuery.data ?? [])
          .filter((record) => record.profiles[1] === communityId)
          .map((record) => [record.profiles[0], record.type] as const)
      ),
    [relationshipsQuery.data, communityId]
  )
  const eligibleProfiles = useMemo(
    () =>
      (ownedProfilesQuery.data ?? []).filter((profile) => {
        const role = rolesByProfileId.get(profile.id)
        return (
          profile.type === communityType &&
          role !== undefined &&
          PUBLISH_ROLES.includes(role)
        )
      }),
    [ownedProfilesQuery.data, communityType, rolesByProfileId]
  )
  const forumProfile = useMemo(
    () =>
      eligibleProfiles.find((profile) => profile.id === currentProfileId) ??
      eligibleProfiles.find(
        (profile) => rolesByProfileId.get(profile.id) === 'owner'
      ) ??
      eligibleProfiles.find(
        (profile) => rolesByProfileId.get(profile.id) === 'moderator'
      ) ??
      eligibleProfiles[0] ??
      null,
    [eligibleProfiles, currentProfileId, rolesByProfileId]
  )
  const forumProfileId = forumProfile?.id ?? null
  const currentRole = forumProfileId
    ? (rolesByProfileId.get(forumProfileId) ?? null)
    : null
  const isMember = Boolean(forumProfileId)
  const isStaff = currentRole === 'owner' || currentRole === 'moderator'

  return {
    relationshipsQuery,
    ownedProfilesQuery,
    forumProfile,
    forumProfileId,
    currentRole,
    isMember,
    isStaff,
    canPublish: Boolean(forumProfile)
  }
}
