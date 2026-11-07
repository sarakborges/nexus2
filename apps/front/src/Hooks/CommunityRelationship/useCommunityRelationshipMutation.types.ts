import type {
  CommunityRelationship,
  CommunityRelationshipType
} from '@nexus/common'
import type { UseMutationResult } from '@tanstack/react-query'

export type CommunityRelationshipOperation =
  | { type: 'update'; relationshipType: CommunityRelationshipType }
  | { type: 'remove' }
  | { type: 'demote' }
  | { type: 'transfer' }

export type CommunityRelationshipMutationVariables = {
  profileId: string
  communityId: string
  actorProfileId: string
  operation: CommunityRelationshipOperation
}

export type UseCommunityRelationshipMutationResult = UseMutationResult<
  CommunityRelationship | void,
  unknown,
  CommunityRelationshipMutationVariables
>
