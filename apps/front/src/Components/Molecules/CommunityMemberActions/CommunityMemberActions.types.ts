import type {
  CommunityRelationship,
  CommunityRelationshipType
} from '@nexus/common'

export type CommunityMemberActionsProps = {
  memberProfileId: string
  communityId: string
  actorProfileId: string
  actorRole: 'owner' | 'moderator'
  relationship: CommunityRelationship | null
}

export type CommunityMemberOperation =
  | { type: 'update'; relationshipType: CommunityRelationshipType }
  | { type: 'remove' }
  | { type: 'demote' }
  | { type: 'transfer' }
