import { useNavigate } from 'react-router'

import { useSignOutMutation } from '@/Hooks/Auth'
import { ROUTES } from '@/Constants/routes'
import type { UseGettingStartedPageResult } from './useGettingStartedPage.types'

export function useGettingStartedPage(): UseGettingStartedPageResult {
  const navigate = useNavigate()
  const signOutMutation = useSignOutMutation()

  return {
    isSigningOut: signOutMutation.isPending,
    hasSignOutError: signOutMutation.isError,
    signOut: () =>
      signOutMutation.mutate(undefined, {
        onSuccess: () => navigate(ROUTES.signIn, { replace: true })
      })
  }
}
