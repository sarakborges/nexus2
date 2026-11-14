import type { ActivityFeedCursor, AuthSession, RecentActivity } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type HomePageActivityFeedProps = {
  homeQuery: UseQueryResult<AuthSession | null>
  activities: RecentActivity[]
  activityCursor: ActivityFeedCursor | null
  hasMoreActivities: boolean
  formatDate: (timestamp: number) => string
}
