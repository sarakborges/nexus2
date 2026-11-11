import type { ActivityFeedCursor, Community, Profile, RecentActivity } from '@nexus/common'

export const DATA_REPOSITORY = Symbol('DATA_REPOSITORY')

export type CollectionRecordMap = Record<string, unknown[]>

export type CollectionTransaction<T> = {
  records: CollectionRecordMap
  result: T
}

export type ActivityFeedRow = {
  id: string
  type: RecentActivity['type']
  updated_at_ms: number
  profile: Profile
  friend: Profile | null
  community: Community | null
  content: string | null
  role: 'owner' | 'moderator' | 'connection' | null
}

/**
 * Collection updaters and transaction callbacks must be synchronous and free
 * of external side effects. Optimistic database transactions may rerun them
 * after a concurrent commit.
 */
export interface DataRepository {
  read<T>(collection: string): Promise<T[]>
  getActivityFeedRows?(
    userId: string,
    limit: number,
    cursor: ActivityFeedCursor | null
  ): Promise<ActivityFeedRow[]>
  readByIds<T extends { id: string }>(collection: string, ids: readonly string[]): Promise<T[]>
  update<T>(collection: string, updater: (records: T[]) => T[]): Promise<T[]>
  transaction<T>(
    collections: readonly string[],
    updater: (records: CollectionRecordMap) => CollectionTransaction<T>
  ): Promise<T>
}
