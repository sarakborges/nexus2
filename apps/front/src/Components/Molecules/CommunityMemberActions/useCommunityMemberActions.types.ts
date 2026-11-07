import type { CommunityRelationshipOperation } from '@/Hooks/CommunityRelationship'

export type UseCommunityMemberActionsOptions = {
  memberProfileId: string
  communityId: string
  actorProfileId: string
}

export type CommunityMemberOperation = CommunityRelationshipOperation

export type CommunityMemberActionsController = {
  confirmTransfer: boolean
  pending: boolean
  hasError: boolean
  retryLastOperation?: () => void
  run: (operation: CommunityMemberOperation) => void
  confirmOwnershipTransfer: () => void
  cancelOwnershipTransfer: () => void
}
