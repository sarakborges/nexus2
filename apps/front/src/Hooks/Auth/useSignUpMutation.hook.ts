import type { AuthenticatedUser, SignUpCredentials } from '@nexus/common'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuthStore } from '@/Stores/Auth.store'
import { cacheAuthenticatedSession } from './authSessionCache.utils'
import type { UseSignUpMutationResult } from './useSignUpMutation.types'

export function useSignUpMutation(): UseSignUpMutationResult {
  const queryClient = useQueryClient()
  const signUp = useAuthStore((state) => state.signUp)

  return useMutation<AuthenticatedUser, unknown, SignUpCredentials>({
    mutationFn: signUp,
    onSuccess: (user) => cacheAuthenticatedSession(queryClient, user)
  })
}
