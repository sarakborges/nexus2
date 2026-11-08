import { useQuery } from '@tanstack/react-query'

import { getRecentActivity } from '@/Services/Activity'
import { queryKeys } from '@/Services/Query/queryKeys'
import type { UseHomeActivityResult } from './useHomeActivity.types'

export function useHomeActivity(userId: string | null): UseHomeActivityResult {
  const activityQuery = useQuery({
    queryKey: queryKeys.activity.recent(userId ?? ''),
    queryFn: getRecentActivity,
    enabled: Boolean(userId),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true
  })

  return {
    activityQuery,
    activities: activityQuery.data ?? []
  }
}
