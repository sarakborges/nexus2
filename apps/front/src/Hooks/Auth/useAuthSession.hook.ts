import { useQuery } from '@tanstack/react-query'
import type { AuthSession } from '@nexus/common'

import { getCurrentAuthSession } from '@/Services/Auth'
import { queryKeys } from '@/Services/Query/queryKeys'
import type { UseAuthSessionResult } from './useAuthSession.types'

export function useAuthSession(): UseAuthSessionResult {
  return useQuery<AuthSession | null, Error>({
    queryKey: queryKeys.auth.session,
    queryFn: getCurrentAuthSession,
    retry: false,
    staleTime: Infinity
  })
}
