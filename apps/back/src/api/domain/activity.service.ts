import { Inject, Injectable } from '@nestjs/common'
import type { ActivityFeedCursor, ActivityFeedPage, RecentActivity } from '@nexus/common'
import {
  DATA_REPOSITORY,
  type ActivityFeedRow,
  type DataRepository
} from '../../storage/repository.interface'
import { sanitizeRichText } from './rich-text-sanitizer'

@Injectable()
export class ActivityService {
  constructor(@Inject(DATA_REPOSITORY) private readonly data: DataRepository) {}

  async getRecentActivityPage(
    userId: string,
    limit = 10,
    cursor: ActivityFeedCursor | null = null
  ): Promise<ActivityFeedPage> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit) || 10, 1), 50)
    const rows = await this.data.getActivityFeedRows(userId, safeLimit, cursor)
    const hasMore = rows.length > safeLimit
    const pageRows = hasMore ? rows.slice(0, safeLimit) : rows
    const items = pageRows.map(row => this.toRecentActivity(row))
    const lastItem = pageRows[pageRows.length - 1]

    return {
      items,
      nextCursor: hasMore && lastItem
        ? { updatedAt: lastItem.updated_at_ms, id: lastItem.id }
        : null,
      hasMore
    }
  }

  private toRecentActivity(row: ActivityFeedRow): RecentActivity {
    if (!Number.isFinite(row.updated_at_ms)) {
      throw new Error('Supabase relational activity feed returned an invalid timestamp.')
    }

    switch (row.type) {
      case 'friend_connected':
        if (!row.friend) throw new Error('Friend activity is missing its related profile.')
        return {
          id: row.id,
          type: row.type,
          updatedAt: row.updated_at_ms,
          profile: row.profile,
          friend: row.friend
        }
      case 'profile_post':
        return {
          id: row.id,
          type: row.type,
          updatedAt: row.updated_at_ms,
          profile: row.profile,
          content: sanitizeRichText(row.content ?? '')
        }
      case 'community_created':
        if (!row.community) throw new Error('Community activity is missing its community.')
        return {
          id: row.id,
          type: row.type,
          updatedAt: row.updated_at_ms,
          profile: row.profile,
          community: row.community
        }
      case 'community_membership':
        if (!row.community || !row.role) {
          throw new Error('Community membership activity is missing its community or role.')
        }
        return {
          id: row.id,
          type: row.type,
          updatedAt: row.updated_at_ms,
          profile: row.profile,
          community: row.community,
          role: row.role
        }
    }

    throw new Error('Unsupported relational activity type.')
  }

  async getRecentActivity(userId: string): Promise<RecentActivity[]> {
    const limit = 50
    const items: RecentActivity[] = []
    let cursor: ActivityFeedCursor | null = null
    for (;;) {
      const rows = await this.data.getActivityFeedRows(userId, limit + 1, cursor)
      const hasMore = rows.length > limit
      const pageRows = hasMore ? rows.slice(0, limit) : rows
      items.push(...pageRows.map(row => this.toRecentActivity(row)))
      const last = pageRows[pageRows.length - 1]
      if (!hasMore || !last) break
      cursor = { updatedAt: last.updated_at_ms, id: last.id }
    }
    return items
  }
}
