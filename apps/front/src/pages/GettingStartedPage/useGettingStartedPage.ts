import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useNavigate } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import { useAuthStore } from '@/Stores/Auth.store'
import type { UseGettingStartedPageResult } from './useGettingStartedPage.types'

export function useGettingStartedPage(): UseGettingStartedPageResult {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const signOut = useAuthStore((state) => state.signOut)
  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      queryClient.clear()
      navigate(ROUTES.signIn, { replace: true })
    }
  })

  return {
    isSigningOut: signOutMutation.isPending,
    hasSignOutError: signOutMutation.isError,
    signOut: () => signOutMutation.mutate()
  }
}
