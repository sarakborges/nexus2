import type { ActivityFeedCursor, ActivityFeedPage } from '@nexus/common'

import { api } from '../Http/api'

export async function getRecentActivity(
  cursor: ActivityFeedCursor | null = null,
  limit = 10
): Promise<ActivityFeedPage> {
  const params: Record<string, number | string> = { limit }
  if (cursor) {
    params.cursorUpdatedAt = cursor.updatedAt
    params.cursorId = cursor.id
  }
  const { data } = await api.get<ActivityFeedPage>('/activity', { params })
  return data
}
