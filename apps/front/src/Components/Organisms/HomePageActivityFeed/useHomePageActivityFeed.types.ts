import type { RefObject } from 'react'
import type { ActivityFeedCursor, RecentActivity } from '@nexus/common'

export type UseHomePageActivityFeedOptions = {
  activities: RecentActivity[]
  activityCursor: ActivityFeedCursor | null
  hasMoreActivities: boolean
}

export type UseHomePageActivityFeedResult = {
  loadedActivities: RecentActivity[]
  hasMore: boolean
  isLoadingMore: boolean
  sentinelRef: RefObject<HTMLDivElement | null>
  loadMore: () => Promise<void>
}
