import type { AuthenticatedUser, SignUpCredentials } from '@nexus/common'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { signUpUser } from '@/Services/Auth'
import { queryKeys } from '@/Services/Query/queryKeys'
import type { UseSignUpMutationResult } from './useSignUpMutation.types'

export function useSignUpMutation(): UseSignUpMutationResult {
  const queryClient = useQueryClient()

  return useMutation<AuthenticatedUser, unknown, SignUpCredentials>({
    mutationFn: signUpUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session })
    }
  })
}
