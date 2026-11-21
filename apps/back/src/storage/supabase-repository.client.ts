import type { Community, Profile } from '@nexus/common'
import { ServiceUnavailableException } from '@nestjs/common'
import type { AccountRepositoryRecord, MediaFileRecord } from './repository.types'

export type DatabaseRow = Record<string, unknown>
const MAX_FILTERED_ROWS = 1000
const SUPABASE_REQUEST_TIMEOUT_MS = 25 * 1000

export class SupabaseRepositoryClient {
  protected readonly baseUrl: string

  constructor(
    projectUrl: string,
    protected readonly publishableKey: string,
    protected readonly apiSecret: string
  ) {
    this.baseUrl = projectUrl.replace(/\/+$/, '')
  }

  protected async readAccounts(rows: DatabaseRow[]): Promise<unknown[]> {
    if (rows.length === 0) return []
    const accountIds = rows.map(row => this.string(row.id))
    const [memberships, preferences] = await Promise.all([
      this.selectRowsByValues('account_profiles', 'account_id', accountIds),
      this.selectRowsByValues('account_preferences', 'account_id', accountIds)
    ])

    return rows.map(row => {
      const preference = preferences.find(item => item.account_id === row.id)
      return {
        id: this.string(row.id),
        email: this.string(row.email),
        password: {
          hash: this.string(row.password_hash),
          salt: this.string(row.password_salt)
        },
        profiles: memberships
          .filter(item => item.account_id === row.id)
          .sort((a, b) => this.number(a.position) - this.number(b.position))
          .map(item => this.string(item.profile_id)),
        currentProfile: this.nullableString(row.current_profile_id),
        ...(preference ? {
          preferences: {
            language: this.string(preference.language),
            theme: this.string(preference.theme)
          }
        } : {})
      }
    })
  }

  protected async selectRowsByValues(
    table: string,
    column: string,
    values: readonly string[],
    filters: readonly (readonly [string, string])[] = []
  ): Promise<DatabaseRow[]> {
    if (values.length === 0) return []
    const url = new URL(this.baseUrl + '/rest/v1/' + table)
    url.searchParams.set('select', '*')
    url.searchParams.set(
      column,
      'in.(' + values.map(value => '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"').join(',') + ')'
    )
    for (const [filterColumn, expression] of filters) {
      url.searchParams.set(filterColumn, expression)
    }
    url.searchParams.set('limit', String(Math.max(values.length * 10, MAX_FILTERED_ROWS)))
    const response = await this.fetchWithTimeout(url, { method: 'GET', headers: this.headers() })
    await this.assertSuccess(response)
    const rows = await response.json() as DatabaseRow[]
    if (!Array.isArray(rows)) {
      throw new Error('Supabase returned an invalid filtered row set for "' + table + '".')
    }
    return rows
  }

  protected async selectRowsByField(
    table: string,
    column: string,
    expression: string
  ): Promise<DatabaseRow[]> {
    const url = new URL(this.baseUrl + '/rest/v1/' + table)
    url.searchParams.set('select', '*')
    url.searchParams.set(column, expression)
    url.searchParams.set('limit', '2')
    const response = await this.fetchWithTimeout(url, { method: 'GET', headers: this.headers() })
    await this.assertSuccess(response)
    const rows = await response.json() as DatabaseRow[]
    if (!Array.isArray(rows)) {
      throw new Error('Supabase returned an invalid filtered row set for "' + table + '".')
    }
    if (rows.length > 1) {
      throw new Error('Supabase returned more than one account for a unique email.')
    }
    return rows
  }

  protected mediaResourceType(value: unknown): MediaFileRecord['resourceType'] {
    if (value == null) return null
    if (
      value === 'profile' || value === 'community' ||
      value === 'profile-message' || value === 'profile-post' ||
      value === 'community-forum-topic' || value === 'community-forum-reply'
    ) return value
    throw new Error('Supabase returned an unsupported media resource type.')
  }

  protected mapMediaFile(row: DatabaseRow): MediaFileRecord {
    if (
      typeof row.id !== 'string' || (row.owner_user_id !== null && typeof row.owner_user_id !== 'string') ||
      typeof row.purpose !== 'string' || typeof row.bucket !== 'string' ||
      typeof row.path !== 'string' || typeof row.content_type !== 'string' ||
      !Number.isFinite(Number(row.expected_size)) ||
      !Number.isFinite(Number(row.created_at_ms)) ||
      !['pending','ready','deleting'].includes(String(row.status))
    ) throw new Error('Supabase returned an invalid media file row.')
    return {
      id: row.id, ownerUserId: typeof row.owner_user_id === 'string' ? row.owner_user_id : null,
      purpose: row.purpose as MediaFileRecord['purpose'],
      bucket: row.bucket, path: row.path, contentType: row.content_type,
      expectedSize: Number(row.expected_size),
      size: row.size == null ? null : Number(row.size),
      status: row.status as MediaFileRecord['status'],
      deletingAt: row.deleting_at_ms == null ? null : Number(row.deleting_at_ms),
      deleteAfter: row.delete_after_ms == null ? null : Number(row.delete_after_ms),
      createdAt: Number(row.created_at_ms),
      completedAt: row.completed_at_ms == null ? null : Number(row.completed_at_ms),
      expiresAt: row.expires_at_ms == null ? null : Number(row.expires_at_ms),
      resourceType: this.mediaResourceType(row.resource_type),
      resourceId: typeof row.resource_id === 'string' ? row.resource_id : null,
      messageFromProfileId: typeof row.message_from_profile_id === 'string' ? row.message_from_profile_id : null,
      messageToProfileId: typeof row.message_to_profile_id === 'string' ? row.message_to_profile_id : null
    }
  }

  protected mapProfile(row: DatabaseRow): Profile {
    if (
      typeof row.id !== 'string' || typeof row.name !== 'string' ||
      typeof row.url !== 'string' || typeof row.picture !== 'string' ||
      typeof row.about !== 'string' || typeof row.type !== 'string' ||
      !Number.isFinite(Number(row.created_at_ms)) ||
      !Number.isFinite(Number(row.last_activity_ms))
    ) throw new Error('Supabase relational profile write returned an invalid profile row.')
    return {
      id: row.id, name: row.name, url: row.url, picture: row.picture,
      about: row.about, type: row.type as Profile['type'],
      createdAt: Number(row.created_at_ms), lastActivity: Number(row.last_activity_ms)
    }
  }

  protected mapCommunity(row: DatabaseRow): Community {
    if (
      typeof row.id !== 'string' || typeof row.name !== 'string' ||
      typeof row.url !== 'string' || typeof row.picture !== 'string' ||
      typeof row.about !== 'string' || typeof row.type !== 'string' ||
      !['public','private','unlisted'].includes(String(row.privacy)) ||
      !Number.isFinite(Number(row.created_at_ms)) ||
      !Number.isFinite(Number(row.last_activity_ms))
    ) throw new Error('Supabase relational community write returned an invalid community row.')
    return {
      id: row.id, name: row.name, url: row.url, picture: row.picture,
      about: row.about, type: row.type as Community['type'],
      privacy: row.privacy as Community['privacy'],
      createdAt: Number(row.created_at_ms), lastActivity: Number(row.last_activity_ms)
    }
  }

  protected async fetchWithTimeout(
    input: string | URL,
    init: RequestInit
  ): Promise<Response> {
    const usesDefaultSignal = !init.signal
    const signal = init.signal ?? AbortSignal.timeout(SUPABASE_REQUEST_TIMEOUT_MS)
    try {
      return await fetch(input, { ...init, signal })
    } catch (error) {
      if (usesDefaultSignal && signal.aborted) {
        throw new ServiceUnavailableException('SUPABASE_REQUEST_TIMEOUT')
      }
      throw error
    }
  }

  protected headers(): Record<string, string> {
    return {
      apikey: this.publishableKey,
      'x-nexus-api-secret': this.apiSecret
    }
  }

  protected string(value: unknown): string {
    return typeof value === 'string' ? value : String(value ?? '')
  }

  protected number(value: unknown): number {
    const result = Number(value)
    if (!Number.isFinite(result)) throw new Error('Supabase returned an invalid numeric field.')
    return result
  }

  protected nullableString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null
  }

  protected nullableNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null
    return this.number(value)
  }

  protected async assertSuccess(response: Response): Promise<void> {
    if (response.ok) return
    const details = await response.text()
    throw new Error('Supabase relational request failed (' + response.status + '): ' + details)
  }
}
