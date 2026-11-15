import { useMutation, useQueryClient } from '@tanstack/react-query'

import { deleteProfileMessage } from '@/Services/ProfileMessage'
import type {
  DeleteProfileMessageMutationVariables,
  UseDeleteProfileMessageMutationOptions,
  UseDeleteProfileMessageMutationResult
} from './useDeleteProfileMessageMutation.types'

export function useDeleteProfileMessageMutation({
  profileUrl
}: UseDeleteProfileMessageMutationOptions): UseDeleteProfileMessageMutationResult {
  const queryClient = useQueryClient()

  return useMutation<void, unknown, DeleteProfileMessageMutationVariables>({
    mutationFn: ({ recipientProfileId, messageId, actorProfileId }) =>
      deleteProfileMessage(recipientProfileId, messageId, actorProfileId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['profile-messages-page', profileUrl]
      })
    }
  })
}
