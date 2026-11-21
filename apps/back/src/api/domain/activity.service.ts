import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
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
    const rows = await this.withRelationalError(() => this.data.getActivityFeedRows(userId, safeLimit, cursor))
    const hasMore = rows.length > safeLimit
    const pageRows = hasMore ? rows.slice(0, safeLimit) : rows
    const readIds = pageRows.length > 0
      ? new Set(await this.withRelationalError(() => this.data.getActivityReadIds(userId, pageRows.map(row => row.id))))
      : new Set<string>()
    const items = pageRows.map(row => this.toRecentActivity(row, readIds.has(row.id)))
    const lastItem = pageRows[pageRows.length - 1]

    return {
      items,
      nextCursor: hasMore && lastItem
        ? { updatedAt: lastItem.updated_at_ms, id: lastItem.id }
        : null,
      hasMore
    }
  }

  private toRecentActivity(row: ActivityFeedRow, isRead = false): RecentActivity {
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
          isRead,
          profile: row.profile,
          friend: row.friend
        }
      case 'profile_post':
        return {
          id: row.id,
          type: row.type,
          updatedAt: row.updated_at_ms,
          isRead,
          profile: row.profile,
          content: sanitizeRichText(row.content ?? '')
        }
      case 'community_created':
        if (!row.community) throw new Error('Community activity is missing its community.')
        return {
          id: row.id,
          type: row.type,
          updatedAt: row.updated_at_ms,
          isRead,
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
          isRead,
          profile: row.profile,
          community: row.community,
          role: row.role
        }
    }

    throw new Error('Unsupported relational activity type.')
  }

  async markActivitiesRead(userId: string, activityIds: readonly string[]): Promise<void> {
    const uniqueIds = [...new Set(activityIds.filter(id => typeof id === 'string' && id.length > 0))]
    if (uniqueIds.length === 0) return
    if (uniqueIds.length > 50) throw new BadRequestException('ACTIVITY_READ_BATCH_TOO_LARGE')
    await this.withRelationalError(() => this.data.markActivitiesRead(userId, uniqueIds, Date.now()))
  }


  private async withRelationalError<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const authenticationCode = [
        'ACCOUNT_NOT_FOUND',
        'ACTIVITY_FEED_USER_REQUIRED',
        'ACTIVITY_READ_USER_REQUIRED'
      ].find(code => message.includes(code))
      if (authenticationCode) throw new UnauthorizedException(authenticationCode)

      const inputCode = [
        'ACTIVITY_FEED_CURSOR_INVALID',
        'ACTIVITY_READ_INPUT_INVALID'
      ].find(code => message.includes(code))
      if (inputCode) throw new BadRequestException(inputCode)
      throw error
    }
  }

  async getRecentActivity(userId: string): Promise<RecentActivity[]> {
    const limit = 50
    const items: RecentActivity[] = []
    let cursor: ActivityFeedCursor | null = null
    for (;;) {
      const rows = await this.withRelationalError(() => this.data.getActivityFeedRows(userId, limit + 1, cursor))
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
