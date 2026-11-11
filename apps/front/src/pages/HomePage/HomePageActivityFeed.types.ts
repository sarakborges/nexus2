import type { ActivityFeedCursor, HomePageData, RecentActivity } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type HomePageActivityFeedProps = {
  homeQuery: UseQueryResult<HomePageData>
  activities: RecentActivity[]
  activityCursor: ActivityFeedCursor | null
  hasMoreActivities: boolean
  formatDate: (timestamp: number) => string
}
