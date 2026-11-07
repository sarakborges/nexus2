import type { CreateProfileInput, Profile } from '@nexus/common'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { updateUserProfile } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import type {
  UpdateProfileMutationVariables,
  UseUpdateProfileMutationResult
} from './useUpdateProfileMutation.types'

export function useUpdateProfileMutation(): UseUpdateProfileMutationResult {
  const queryClient = useQueryClient()

  return useMutation<Profile, unknown, UpdateProfileMutationVariables>({
    mutationFn: ({ profileId, input }) => updateUserProfile(profileId, input),
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKeys.profiles.byUrl(updated.url), updated)
      await queryClient.invalidateQueries({ queryKey: ['profiles'] })
    }
  })
}
