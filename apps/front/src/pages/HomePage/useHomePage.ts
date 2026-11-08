import { useQuery } from '@tanstack/react-query'

import { getHomePage } from '@/Services/Home'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import type { UseHomePageResult } from './useHomePage.types'

export function useHomePage(): UseHomePageResult {
  const userId = useAuthStore((state) => state.session?.user.id ?? null)

  const homeQuery = useQuery({
    queryKey: queryKeys.home(userId ?? ''),
    queryFn: getHomePage,
    enabled: Boolean(userId),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true
  })

  return { homeQuery }
}
