import type { RecentActivity } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type UseHomeActivityResult = {
  activityQuery: UseQueryResult<RecentActivity[]>
  activities: RecentActivity[]
}
