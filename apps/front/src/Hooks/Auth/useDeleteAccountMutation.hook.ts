import { useMutation, useQueryClient } from '@tanstack/react-query'

import { deleteCurrentAccount } from '@/Services/Auth'
import type { UseDeleteAccountMutationResult } from './useDeleteAccountMutation.types'

export function useDeleteAccountMutation(): UseDeleteAccountMutationResult {
  const queryClient = useQueryClient()

  return useMutation<void, unknown, void>({
    mutationFn: deleteCurrentAccount,
    onSuccess: () => {
      queryClient.clear()
    }
  })
}
