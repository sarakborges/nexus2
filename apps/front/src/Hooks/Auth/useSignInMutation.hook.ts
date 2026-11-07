import type { AuthenticatedUser, SignInCredentials } from '@nexus/common'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuthStore } from '@/Stores/Auth.store'
import { cacheAuthenticatedSession } from './authSessionCache.utils'
import type { UseSignInMutationResult } from './useSignInMutation.types'

export function useSignInMutation(): UseSignInMutationResult {
  const queryClient = useQueryClient()
  const signIn = useAuthStore((state) => state.signIn)

  return useMutation<AuthenticatedUser, unknown, SignInCredentials>({
    mutationFn: signIn,
    onSuccess: (user) => cacheAuthenticatedSession(queryClient, user)
  })
}
