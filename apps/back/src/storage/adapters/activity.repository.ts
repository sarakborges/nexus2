import type { ActivityFeedCursor, ActivityFeedRow } from '../repository.types'
import { SupabaseRepositoryClient } from '../supabase-repository.client'
import type { ActivityRepository } from '../contracts/activity.repository.interface'

export class SupabaseActivityRepository extends SupabaseRepositoryClient implements ActivityRepository {
  constructor(projectUrl: string, publishableKey: string, apiSecret: string) {
    super(projectUrl, publishableKey, apiSecret)
  }

  async getActivityFeedRows(
    userId: string,
    limit: number,
    cursor: ActivityFeedCursor | null
  ): Promise<ActivityFeedRow[]> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_activity_feed_page', {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_limit: limit,
        p_cursor_updated_at_ms: cursor?.updatedAt ?? null,
        p_cursor_id: cursor?.id ?? null
      })
    })
    await this.assertSuccess(response)

    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.some(row =>
      typeof row !== 'object' || row === null ||
      typeof (row as Record<string, unknown>).id !== 'string' ||
      typeof (row as Record<string, unknown>).type !== 'string' ||
      !Number.isFinite(Number((row as Record<string, unknown>).updated_at_ms)) ||
      typeof (row as Record<string, unknown>).profile !== 'object' ||
      (row as Record<string, unknown>).profile === null
    )) {
      throw new Error('Supabase relational activity feed returned an invalid page.')
    }

    return rows as ActivityFeedRow[]
  }

  async getActivityReadIds(userId: string, activityIds: readonly string[]): Promise<string[]> {
    if (activityIds.length === 0) return []
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_activity_read_ids', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_user_id: userId, p_activity_ids: [...activityIds] })
    })
    await this.assertSuccess(response)
    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.some(row =>
      typeof row !== 'object' || row === null ||
      typeof (row as Record<string, unknown>).activity_id !== 'string'
    )) {
      throw new Error('Supabase activity read state returned an invalid result.')
    }
    return rows.map(row => (row as Record<string, string>).activity_id)
  }

  async markActivitiesRead(userId: string, activityIds: readonly string[], readAt: number): Promise<void> {
    if (activityIds.length === 0) return
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_mark_activities_read', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: userId,
        p_activity_ids: [...activityIds],
        p_read_at_ms: readAt
      })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (!Number.isSafeInteger(Number(result)) || Number(result) < 0) {
      throw new Error('Supabase activity read state write returned an invalid result.')
    }
  }
}
