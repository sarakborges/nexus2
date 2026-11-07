import type { CommunityRelationship } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type UseCommunityAccessOptions = {
  communityId: string | null
  viewerUserId: string | null
  profileIds?: string[]
  enabled?: boolean
}

export type UseCommunityAccessResult = {
  relationshipsQuery: UseQueryResult<CommunityRelationship[]>
  relationships: CommunityRelationship[]
  ownerRelationship: CommunityRelationship | null
  ownerProfileId: string | null
  isOwner: boolean
  managementRelationship: CommunityRelationship | null
  managementProfileId: string | null
  currentRole: CommunityRelationship['type'] | null
  isStaff: boolean
}
