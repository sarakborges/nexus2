import type { CommunityRelationship } from '@nexus/common'
import { useQuery } from '@tanstack/react-query'

import { getCommunityRelationships } from '@/Services/CommunityRelationship'
import { queryKeys } from '@/Services/Query/queryKeys'
import type {
  UseCommunityAccessOptions,
  UseCommunityAccessResult
} from './useCommunityAccess.types'

const EMPTY_PROFILE_IDS: string[] = []
const EMPTY_RELATIONSHIPS: CommunityRelationship[] = []

export function useCommunityAccess({
  communityId,
  viewerUserId,
  profileIds = EMPTY_PROFILE_IDS,
  enabled = true
}: UseCommunityAccessOptions): UseCommunityAccessResult {
  const relationshipsQuery = useQuery({
    queryKey: queryKeys.communityRelationships(
      communityId ?? '',
      viewerUserId
    ),
    queryFn: () => getCommunityRelationships(communityId!),
    enabled: Boolean(communityId) && enabled
  })
  const relationships = relationshipsQuery.data ?? EMPTY_RELATIONSHIPS
  const ownerRelationship =
    relationships.find((record) => record.type === 'owner') ?? null
  const ownerProfileId = ownerRelationship?.profiles[0] ?? null
  const isOwner = Boolean(ownerProfileId && profileIds.includes(ownerProfileId))
  const managementRelationship =
    relationships.find(
      (record) =>
        (record.type === 'owner' || record.type === 'moderator') &&
        profileIds.includes(record.profiles[0])
    ) ?? null
  const managementProfileId = managementRelationship?.profiles[0] ?? null

  return {
    relationshipsQuery,
    relationships,
    ownerRelationship,
    ownerProfileId,
    isOwner,
    managementRelationship,
    managementProfileId,
    currentRole: managementRelationship?.type ?? null,
    isStaff: Boolean(managementProfileId)
  }
}
