import type { HomePageData, RecentActivity } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type HomePageActivityFeedProps = {
  homeQuery: UseQueryResult<HomePageData>
  activities: RecentActivity[]
  formatDate: (timestamp: number) => string
}
