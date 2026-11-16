import type { AuthenticatedUser, SignInCredentials } from '@nexus/common'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { signInUser } from '@/Services/Auth'
import { queryKeys } from '@/Services/Query/queryKeys'
import type { UseSignInMutationResult } from './useSignInMutation.types'

export function useSignInMutation(): UseSignInMutationResult {
  const queryClient = useQueryClient()

  return useMutation<AuthenticatedUser, unknown, SignInCredentials>({
    mutationFn: signInUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session })
    }
  })
}
