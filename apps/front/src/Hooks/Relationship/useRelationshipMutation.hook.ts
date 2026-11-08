import type { Relationship } from '@nexus/common'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { removeRelationship, setRelationship } from '@/Services/Relationship'
import type {
  RelationshipMutationVariables,
  UseRelationshipMutationResult
} from './useRelationshipMutation.types'

export function useRelationshipMutation(): UseRelationshipMutationResult {
  const queryClient = useQueryClient()

  return useMutation<
    Relationship | void,
    unknown,
    RelationshipMutationVariables
  >({
    mutationFn: ({ sourceProfileId, targetProfileId, action }) =>
      action.type === 'remove'
        ? removeRelationship(sourceProfileId, targetProfileId)
        : setRelationship(sourceProfileId, targetProfileId, action.type),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['relationships'] }),
        queryClient.invalidateQueries({ queryKey: ['home'] }),
        queryClient.invalidateQueries({ queryKey: ['profile-page'] })
      ])
    }
  })
}
