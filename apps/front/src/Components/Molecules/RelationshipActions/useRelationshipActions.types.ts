import type { RelationshipMutationAction } from '@/Hooks/Relationship'

import type { RelationshipActionsProps } from './RelationshipActions.types'

export type UseRelationshipActionsOptions = RelationshipActionsProps

export type RelationshipAction = RelationshipMutationAction

export type RelationshipActionsController = {
  isAuthenticated: boolean
  canInteract: boolean
  isCommunity: boolean
  isLoading: boolean
  isFetching: boolean
  isQueryError: boolean
  isMutationPending: boolean
  isMutationError: boolean
  isOwnerOrModerator: boolean
  isBlockedByOther: boolean
  isLegacyBlock: boolean
  isConnection: boolean
  isBlockedByCurrent: boolean
  isIncomingRequest: boolean
  isOwnRequest: boolean
  isLegacyRequest: boolean
  canBlock: boolean
  run: (action: RelationshipAction) => void
  handleRequestOrAccept: () => void
  refetch: () => void
  retryLastAction?: () => void
}
