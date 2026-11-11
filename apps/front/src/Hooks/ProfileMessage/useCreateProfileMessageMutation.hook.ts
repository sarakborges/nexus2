import type { ProfileMessage } from '@nexus/common'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  ProfileMessageError,
  createProfileMessage
} from '@/Services/ProfileMessage'
import type {
  CreateProfileMessageMutationVariables,
  UseCreateProfileMessageMutationResult
} from './useCreateProfileMessageMutation.types'

export function useCreateProfileMessageMutation(): UseCreateProfileMessageMutationResult {
  const queryClient = useQueryClient()

  return useMutation<
    ProfileMessage,
    ProfileMessageError,
    CreateProfileMessageMutationVariables
  >({
    mutationFn: ({ fromProfileId, toProfileId, content }) =>
      createProfileMessage(fromProfileId, toProfileId, content),
    onSuccess: async (_message, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['profile-messages', variables.toProfileId]
        }),
        queryClient.invalidateQueries({
          queryKey: ['profile-messages-page']
        })
      ])
    }
  })
}
