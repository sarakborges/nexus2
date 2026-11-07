import type { AuthenticatedUser } from '@nexus/common'
import type { QueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'

export function cacheAuthenticatedSession(
  queryClient: QueryClient,
  user: AuthenticatedUser
): void {
  const session = useAuthStore.getState().session
  if (session?.user.id !== user.id) return

  queryClient.setQueryData(queryKeys.auth.session, session)
}
