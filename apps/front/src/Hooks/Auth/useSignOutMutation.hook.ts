import { useMutation } from '@tanstack/react-query'

import { useAuthStore } from '@/Stores/Auth.store'
import type { UseSignOutMutationResult } from './useSignOutMutation.types'

export function useSignOutMutation(): UseSignOutMutationResult {
  const signOut = useAuthStore((state) => state.signOut)

  return useMutation<void, unknown, void>({
    mutationFn: signOut
  })
}
