import { useQuery } from '@tanstack/react-query'

import { getCurrentAuthSession } from '@/Services/Auth'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import type { UseHomePageResult } from './useHomePage.types'

export function useHomePage(): UseHomePageResult {
  const userId = useAuthStore((state) => state.session?.user.id ?? null)
  const session = useAuthStore((state) => state.session)

  const homeQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: getCurrentAuthSession,
    enabled: Boolean(userId),
    initialData: session ?? undefined,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true
  })

  return { homeQuery }
}
