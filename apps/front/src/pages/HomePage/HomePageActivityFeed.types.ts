import type { RecentActivity } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type HomePageActivityFeedProps = {
  activityQuery: UseQueryResult<RecentActivity[]>
  activities: RecentActivity[]
  formatDate: (timestamp: number) => string
}
