import type { ActivityFeedCursor, CollectionRecordMap, DataRepository, ActivityFeedRow } from './repository.interface'

type DatabaseRow = Record<string, unknown>
type CollectionSnapshot = {
  records: unknown[]
  revision: number
}

const MAX_UPDATE_ATTEMPTS = 8
const PAGE_SIZE = 1000

const WRITE_COLLECTIONS = [
  'accounts',
  'profiles',
  'communities',
  'relationships',
  'community_relationships',
  'profile_posts',
  'profile_settings',
  'profile_messages',
  'community_forum_topics',
  'community_forum_replies',
  'refresh_tokens',
  'media_files'
] as const

const READ_COLLECTIONS = [...WRITE_COLLECTIONS, 'feed_activities'] as const

export class SupabaseRelationalRepository implements DataRepository {
  private readonly baseUrl: string

  constructor(
    projectUrl: string,
    private readonly publishableKey: string,
    private readonly apiSecret: string
  ) {
    this.baseUrl = projectUrl.replace(/\/+$/, '')
  }

  async read<T>(collection: string): Promise<T[]> {
    this.assertReadableCollection(collection)
    if (collection === 'feed_activities') {
      return await this.readCollection(collection) as T[]
    }
    const snapshots = await this.readSnapshots([collection])
    return snapshots.get(collection)!.records as T[]
  }

  async readByIds<T extends { id: string }>(
    collection: string,
    ids: readonly string[]
  ): Promise<T[]> {
    const requestedIds = new Set(ids)
    if (requestedIds.size === 0) return []
    return (await this.read<T>(collection)).filter(record => requestedIds.has(record.id))
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

  async update<T>(
    collection: string,
    updater: (records: T[]) => T[]
  ): Promise<T[]> {
    let updated: T[] | undefined
    await this.transaction<T[]>([collection], collections => {
      const current = collections[collection] as T[]
      updated = updater(current)
      if (!Array.isArray(updated)) {
        throw new Error('Collection updater must return an array.')
      }
      return {
        records: { ...collections, [collection]: updated },
        result: updated
      }
    })
    return updated!
  }

  async transaction<T>(
    collections: readonly string[],
    updater: (records: CollectionRecordMap) => { records: CollectionRecordMap; result: T }
  ): Promise<T> {
    const names = this.validateTransactionCollections(collections)

    for (let attempt = 0; attempt < MAX_UPDATE_ATTEMPTS; attempt += 1) {
      const snapshots = await this.readSnapshots(names)
      const current: CollectionRecordMap = {}
      for (const name of names) {
        current[name] = structuredClone(snapshots.get(name)!.records)
      }

      const outcome = updater(current)
      if (!outcome || typeof outcome !== 'object' || !outcome.records || typeof outcome.records !== 'object') {
        throw new Error('Collection transaction must return records and a result.')
      }

      const changes = names.flatMap(name => {
        const records = outcome.records[name]
        if (!Array.isArray(records)) {
          throw new Error('Collection transaction must return an array for "' + name + '".')
        }
        if (records === current[name]) return []
        if (!(WRITE_COLLECTIONS as readonly string[]).includes(name)) {
          throw new Error('Collection "' + name + '" is read-only.')
        }
        return [{
          collection: name,
          expected_revision: snapshots.get(name)!.revision,
          records
        }]
      })

      if (changes.length === 0) return outcome.result

      const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_commit_relational', {
        method: 'POST',
        headers: {
          ...this.headers(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_changes: changes })
      })

      if (response.status === 409) {
        await this.backoff(attempt)
        continue
      }
      await this.assertSuccess(response)

      const result = await response.json() as { committed?: unknown }
      if (result?.committed === true) return outcome.result
      if (result?.committed === false) {
        await this.backoff(attempt)
        continue
      }
      throw new Error('Supabase relational transaction returned an invalid commit result.')
    }

    throw new Error(
      'Concurrent updates prevented relational transaction (' + names.join(', ') +
      ') from being saved after ' + MAX_UPDATE_ATTEMPTS + ' attempts.'
    )
  }

  private async readSnapshots(
    collections: readonly string[]
  ): Promise<Map<string, CollectionSnapshot>> {
    const names = [...collections]
    for (let attempt = 0; attempt < MAX_UPDATE_ATTEMPTS; attempt += 1) {
      const before = await this.readRevisions(names)
      const rows = await Promise.all(names.map(name => this.readCollection(name)))
      const after = await this.readRevisions(names)

      if (names.some(name => before.get(name) !== after.get(name))) {
        await this.backoff(attempt)
        continue
      }

      return new Map(names.map((name, index) => [
        name,
        { records: rows[index], revision: after.get(name) ?? 0 }
      ]))
    }

    throw new Error(
      'A consistent relational snapshot could not be read for (' + names.join(', ') +
      ') after ' + MAX_UPDATE_ATTEMPTS + ' attempts.'
    )
  }

  private async readRevisions(collections: readonly string[]): Promise<Map<string, number>> {
    if (collections.length === 0) return new Map()
    const url = new URL(this.baseUrl + '/rest/v1/nexus_collection_versions')
    url.searchParams.set('select', 'collection,revision')
    url.searchParams.set(
      'collection',
      'in.(' + collections.filter(name => name !== 'feed_activities').join(',') + ')'
    )
    url.searchParams.set('limit', String(collections.length))

    const names = collections.filter(name => name !== 'feed_activities')
    if (names.length === 0) return new Map(collections.map(name => [name, 0]))

    const response = await fetch(url, { method: 'GET', headers: this.headers() })
    await this.assertSuccess(response)
    const rows = await response.json() as DatabaseRow[]
    if (!Array.isArray(rows)) {
      throw new Error('Supabase returned an invalid relational version snapshot.')
    }

    const revisions = new Map<string, number>(collections.map(name => [name, 0]))
    for (const row of rows) {
      if (typeof row.collection !== 'string' || !names.includes(row.collection)) {
        throw new Error('Supabase returned an unknown relational collection version.')
      }
      const revision = Number(row.revision)
      if (!Number.isSafeInteger(revision) || revision < 0) {
        throw new Error('Supabase returned an invalid relational collection revision.')
      }
      revisions.set(row.collection, revision)
    }
    return revisions
  }

  private async readCollection(collection: string): Promise<unknown[]> {
    this.assertReadableCollection(collection)

    switch (collection) {
      case 'accounts': {
        const [accounts, memberships, preferences] = await Promise.all([
          this.selectRows('accounts'),
          this.selectRows('account_profiles'),
          this.selectRows('account_preferences')
        ])
        return accounts.map(row => {
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
      case 'profiles': {
        const rows = await this.selectRows('profiles')
        return rows.map(row => ({
          id: this.string(row.id),
          name: this.string(row.name),
          url: this.string(row.url),
          picture: this.string(row.picture),
          about: this.string(row.about),
          type: this.string(row.type),
          createdAt: this.number(row.created_at_ms),
          lastActivity: this.number(row.last_activity_ms)
        }))
      }
      case 'communities': {
        const rows = await this.selectRows('communities')
        return rows.map(row => ({
          id: this.string(row.id),
          name: this.string(row.name),
          url: this.string(row.url),
          picture: this.string(row.picture),
          about: this.string(row.about),
          type: this.string(row.type),
          privacy: this.string(row.privacy),
          createdAt: this.number(row.created_at_ms),
          lastActivity: this.number(row.last_activity_ms)
        }))
      }
      case 'relationships': {
        const rows = await this.selectRows('relationships')
        return rows.map(row => ({
          profiles: [this.string(row.profile_id), this.string(row.related_profile_id)],
          type: this.string(row.type),
          requestedBy: this.nullableString(row.requested_by),
          blockedBy: this.nullableString(row.blocked_by),
          updatedAt: this.number(row.updated_at_ms)
        }))
      }
      case 'community_relationships': {
        const rows = await this.selectRows('community_relationships')
        return rows.map(row => ({
          profiles: [this.string(row.profile_id), this.string(row.community_id)],
          type: this.string(row.type),
          requestedBy: this.nullableString(row.requested_by),
          blockedBy: this.nullableString(row.blocked_by),
          updatedAt: this.number(row.updated_at_ms)
        }))
      }
      case 'profile_posts': {
        const rows = await this.selectRows('profile_posts')
        return rows.map(row => ({
          id: this.string(row.id),
          profileId: this.string(row.profile_id),
          content: this.string(row.content),
          createdAt: this.number(row.created_at_ms)
        }))
      }
      case 'profile_settings': {
        const [settings, preferences] = await Promise.all([
          this.selectRows('profile_settings'),
          this.selectRows('profile_activity_preferences')
        ])
        return settings.map(row => {
          const profilePreferences = preferences.filter(item => item.profile_id === row.profile_id)
          return {
            profileId: this.string(row.profile_id),
            messageAudience: this.string(row.message_audience),
            publishActivityTypes: profilePreferences
              .filter(item => item.publish_activity === true)
              .map(item => this.string(item.activity_type)),
            showFriendActivityTypes: profilePreferences
              .filter(item => item.show_friend_activity === true)
              .map(item => this.string(item.activity_type))
          }
        })
      }
      case 'profile_messages': {
        const rows = await this.selectRows('profile_messages')
        return rows.map(row => ({
          id: this.string(row.id),
          fromProfileId: this.string(row.from_profile_id),
          toProfileId: this.string(row.to_profile_id),
          content: this.string(row.content),
          createdAt: this.number(row.created_at_ms),
          isFavorite: row.is_favorite === true
        }))
      }
      case 'community_forum_topics': {
        const rows = await this.selectRows('community_forum_topics')
        return rows.map(row => ({
          id: this.string(row.id),
          communityId: this.string(row.community_id),
          profileId: this.string(row.profile_id),
          title: this.string(row.title),
          content: this.string(row.content),
          createdAt: this.number(row.created_at_ms),
          updatedAt: this.number(row.updated_at_ms),
          isPinned: row.is_pinned === true,
          isLocked: row.is_locked === true
        }))
      }
      case 'community_forum_replies': {
        const rows = await this.selectRows('community_forum_replies')
        return rows.map(row => ({
          id: this.string(row.id),
          topicId: this.string(row.topic_id),
          communityId: this.string(row.community_id),
          profileId: this.string(row.profile_id),
          content: this.string(row.content),
          createdAt: this.number(row.created_at_ms),
          updatedAt: this.number(row.updated_at_ms)
        }))
      }
      case 'refresh_tokens': {
        const rows = await this.selectRows('refresh_tokens')
        return rows.map(row => ({
          id: this.string(row.id),
          userId: this.string(row.user_id),
          tokenHash: this.string(row.token_hash),
          expiresAt: this.number(row.expires_at_ms)
        }))
      }
      case 'media_files': {
        const rows = await this.selectRows('media_files')
        return rows.map(row => ({
          id: this.string(row.id),
          ownerUserId: this.string(row.owner_user_id),
          purpose: this.string(row.purpose),
          bucket: this.string(row.bucket),
          path: this.string(row.path),
          contentType: this.string(row.content_type),
          expectedSize: this.number(row.expected_size),
          size: this.nullableNumber(row.size),
          status: this.string(row.status),
          deletingAt: this.nullableNumber(row.deleting_at_ms),
          deleteAfter: this.nullableNumber(row.delete_after_ms),
          createdAt: this.number(row.created_at_ms),
          completedAt: this.nullableNumber(row.completed_at_ms),
          expiresAt: this.nullableNumber(row.expires_at_ms),
          resourceType: this.nullableString(row.resource_type),
          resourceId: this.nullableString(row.resource_id),
          messageFromProfileId: this.nullableString(row.message_from_profile_id),
          messageToProfileId: this.nullableString(row.message_to_profile_id)
        }))
      }
      case 'feed_activities': {
        const rows = await this.selectRows('feed_activities')
        return rows.map(row => ({
          id: this.string(row.id),
          type: this.string(row.type),
          profileId: this.string(row.actor_profile_id),
          friendId: this.nullableString(row.target_profile_id),
          communityId: this.nullableString(row.community_id),
          postId: this.nullableString(row.profile_post_id),
          role: this.nullableString(row.role),
          updatedAt: this.number(row.updated_at_ms)
        }))
      }
      default:
        throw new Error('Unsupported relational collection: ' + collection)
    }
  }

  private async selectRows(table: string): Promise<DatabaseRow[]> {
    const rows: DatabaseRow[] = []
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const url = new URL(this.baseUrl + '/rest/v1/' + table)
      url.searchParams.set('select', '*')
      url.searchParams.set('limit', String(PAGE_SIZE))
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...this.headers(),
          Range: offset + '-' + (offset + PAGE_SIZE - 1),
          'Range-Unit': 'items'
        }
      })
      await this.assertSuccess(response)
      const page = await response.json() as DatabaseRow[]
      if (!Array.isArray(page)) {
        throw new Error('Supabase returned an invalid row set for "' + table + '".')
      }
      rows.push(...page)
      if (page.length < PAGE_SIZE) return rows
    }
  }

  private headers(): Record<string, string> {
    return {
      apikey: this.publishableKey,
      'x-nexus-api-secret': this.apiSecret
    }
  }

  private validateTransactionCollections(collections: readonly string[]): string[] {
    const names = [...new Set(collections)]
    if (names.length === 0 || names.length !== collections.length) {
      throw new Error('Relational transaction requires a non-empty list of unique collections.')
    }
    for (const name of names) {
      if (!(WRITE_COLLECTIONS as readonly string[]).includes(name) &&
          name !== 'feed_activities') {
        throw new Error('Unsupported relational collection: ' + name)
      }
    }
    return names.sort()
  }

  private assertReadableCollection(collection: string): void {
    if (!(READ_COLLECTIONS as readonly string[]).includes(collection)) {
      throw new Error('Unsupported relational collection: ' + collection)
    }
  }

  private string(value: unknown): string {
    return typeof value === 'string' ? value : String(value ?? '')
  }

  private number(value: unknown): number {
    const result = Number(value)
    if (!Number.isFinite(result)) throw new Error('Supabase returned an invalid numeric field.')
    return result
  }

  private nullableString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null
  }

  private nullableNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null
    return this.number(value)
  }

  private async backoff(attempt: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, Math.min(5 * (attempt + 1), 40)))
  }

  private async assertSuccess(response: Response): Promise<void> {
    if (response.ok) return
    const details = await response.text()
    throw new Error('Supabase relational request failed (' + response.status + '): ' + details)
  }
}
