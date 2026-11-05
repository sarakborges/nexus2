import type { CommunityRelationshipType } from '@nexus/common'

export type UseCommunityMemberActionsOptions = {
  memberProfileId: string
  communityId: string
  actorProfileId: string
}

export type CommunityMemberOperation =
  | { type: 'update'; relationshipType: CommunityRelationshipType }
  | { type: 'remove' }
  | { type: 'demote' }
  | { type: 'transfer' }

export type CommunityMemberActionsController = {
  confirmTransfer: boolean
  pending: boolean
  hasError: boolean
  retryLastOperation?: () => void
  run: (operation: CommunityMemberOperation) => void
  confirmOwnershipTransfer: () => void
  cancelOwnershipTransfer: () => void
}
