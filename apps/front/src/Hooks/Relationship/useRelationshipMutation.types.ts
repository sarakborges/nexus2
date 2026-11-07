import type { Relationship, RelationshipType } from '@nexus/common'
import type { UseMutationResult } from '@tanstack/react-query'

export type RelationshipMutationAction =
  | { type: 'remove' }
  | { type: RelationshipType }

export type RelationshipMutationVariables = {
  sourceProfileId: string
  targetProfileId: string
  action: RelationshipMutationAction
}

export type UseRelationshipMutationResult = UseMutationResult<
  Relationship | void,
  unknown,
  RelationshipMutationVariables
>
