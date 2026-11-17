import { useMutation, useQueryClient } from '@tanstack/react-query'

import { signOutUser } from '@/Services/Auth'
import { queryKeys } from '@/Services/Query/queryKeys'
import type { UseSignOutMutationResult } from './useSignOutMutation.types'

export function useSignOutMutation(): UseSignOutMutationResult {
  const queryClient = useQueryClient()

  return useMutation<void, unknown, void>({
    mutationFn: signOutUser,
    onSuccess: () => {
      queryClient.removeQueries({
        predicate: query =>
          query.queryKey[0] !== 'auth' || query.queryKey[1] !== 'session'
      })
      queryClient.setQueryData(queryKeys.auth.session, null)
    }
  })
}
