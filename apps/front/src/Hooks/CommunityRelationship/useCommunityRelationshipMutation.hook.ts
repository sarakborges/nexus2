import type { CommunityRelationship } from '@nexus/common'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  demoteCommunityModerator,
  removeCommunityRelationship,
  setCommunityRelationship,
  transferCommunityOwnership
} from '@/Services/CommunityRelationship'
import type {
  CommunityRelationshipMutationVariables,
  UseCommunityRelationshipMutationResult
} from './useCommunityRelationshipMutation.types'

export function useCommunityRelationshipMutation(): UseCommunityRelationshipMutationResult {
  const queryClient = useQueryClient()

  return useMutation<
    CommunityRelationship | void,
    unknown,
    CommunityRelationshipMutationVariables
  >({
    mutationFn: ({ profileId, communityId, actorProfileId, operation }) => {
      if (operation.type === 'remove') {
        return removeCommunityRelationship(profileId, communityId, actorProfileId)
      }
      if (operation.type === 'demote') {
        return demoteCommunityModerator(profileId, communityId, actorProfileId)
      }
      if (operation.type === 'transfer') {
        return transferCommunityOwnership(actorProfileId, profileId, communityId)
      }
      return setCommunityRelationship(
        profileId,
        communityId,
        operation.relationshipType,
        actorProfileId
      )
    },
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['community-relationships', variables.communityId] }),
        queryClient.invalidateQueries({ queryKey: ['community-members', variables.communityId] }),
        queryClient.invalidateQueries({ queryKey: ['home'] }),
        queryClient.invalidateQueries({ queryKey: ['profile-page'] }),
        queryClient.invalidateQueries({ queryKey: ['community-page'] }),
        queryClient.invalidateQueries({ queryKey: ['community-forum-page'] }),
        queryClient.invalidateQueries({ queryKey: ['community-forum-topic-page'] }),
        queryClient.invalidateQueries({ queryKey: ['community-forum-composer-page'] }),
        queryClient.invalidateQueries({ queryKey: ['community-edit-page'] }),
        queryClient.invalidateQueries({ queryKey: ['community-members-page'] }),
        queryClient.invalidateQueries({ queryKey: ['profile-directory-page'] })
      ])
    }
  })
}
