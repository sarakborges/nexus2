import type { ActivityFeedCursor, ActivityFeedRow } from '../repository.types'

export interface ActivityRepository {
  getActivityFeedRows(
    userId: string,
    limit: number,
    cursor: ActivityFeedCursor | null
  ): Promise<ActivityFeedRow[]>
  getActivityReadIds(userId: string, activityIds: readonly string[]): Promise<string[]>
  markActivitiesRead(userId: string, activityIds: readonly string[], readAt: number): Promise<void>
}
}
