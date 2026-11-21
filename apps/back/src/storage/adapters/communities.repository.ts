import type { CommunitiesPageData, Community, CommunityCreateWrite, CommunityEditPageData, CommunityForumComposerPageData, CommunityMembersPageData, CommunityPageData, CommunityUpdateWrite, ListSort, PaginatedResult } from '../repository.types'
import { SupabaseRepositoryClient } from '../supabase-repository.client'
import type { DatabaseRow } from '../supabase-repository.client'
import type { CommunitiesRepository } from '../contracts/communities.repository.interface'

export class SupabaseCommunitiesRepository extends SupabaseRepositoryClient implements CommunitiesRepository {
  constructor(projectUrl: string, publishableKey: string, apiSecret: string) {
    super(projectUrl, publishableKey, apiSecret)
  }

  async getCommunitiesByIds(ids: readonly string[]): Promise<Community[]> {
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length === 0) return []

    const [communityRows, relationshipRows] = await Promise.all([
      this.selectRowsByValues('communities', 'id', uniqueIds),
      this.selectRowsByValues(
        'community_relationships',
        'community_id',
        uniqueIds,
        [['type', 'eq.owner']]
      )
    ])
    const ownerRelationships = relationshipRows
      .filter(row => row.type === 'owner')
      .sort((left, right) =>
        Number(left.updated_at_ms ?? 0) - Number(right.updated_at_ms ?? 0) ||
        this.string(left.profile_id).localeCompare(this.string(right.profile_id))
      )
    const ownerProfileByCommunityId = new Map<string, string>()
    for (const relationship of ownerRelationships) {
      const communityId = this.string(relationship.community_id)
      if (!ownerProfileByCommunityId.has(communityId)) {
        ownerProfileByCommunityId.set(communityId, this.string(relationship.profile_id))
      }
    }
    const ownerProfileIds = [...new Set(ownerProfileByCommunityId.values())]
    const ownerProfiles = ownerProfileIds.length > 0
      ? await this.selectRowsByValues('profiles', 'id', ownerProfileIds)
      : []
    const profileTypes = new Map(ownerProfiles.map(row => [
      this.string(row.id),
      this.string(row.type)
    ] as const))

    return communityRows.map(row => {
      const id = this.string(row.id)
      const ownerProfileId = ownerProfileByCommunityId.get(id)
      const inheritedType = ownerProfileId ? profileTypes.get(ownerProfileId) : undefined
      const createdAt = Number.isFinite(Number(row.created_at_ms))
        ? Number(row.created_at_ms)
        : 0
      const privacy = row.privacy
      const lastActivity = Number.isFinite(Number(row.last_activity_ms))
        ? Number(row.last_activity_ms)
        : createdAt
      return this.mapCommunity({
        ...row,
        type: inheritedType ?? row.type,
        privacy,
        created_at_ms: createdAt,
        last_activity_ms: lastActivity
      })
    })
  }

  async getSuggestedCommunities(profileId: string, limit: number): Promise<Community[]> {
    const response = await this.fetchWithTimeout(this.baseUrl + '/rest/v1/rpc/nexus_get_suggested_communities', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_profile_id: profileId, p_limit: limit })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (!Array.isArray(result)) {
      throw new Error('Supabase suggested communities returned an invalid result.')
    }
    return result as Community[]
  }

  async createCommunity(change: CommunityCreateWrite): Promise<Community> {
    const response = await this.fetchWithTimeout(this.baseUrl + '/rest/v1/rpc/nexus_create_community', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_owner_profile_id: change.ownerProfileId,
        p_community_id: change.id,
        p_name: change.name,
        p_url: change.url,
        p_picture: change.picture,
        p_about: change.about,
        p_privacy: change.privacy,
        p_created_at_ms: change.createdAt,
        p_avatar_path: change.avatarPath,
        p_editor_image_ids: [...change.editorImageIds]
      })
    })
    await this.assertSuccess(response)
    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error('Supabase relational community creation returned an invalid result.')
    }
    return this.mapCommunity(rows[0] as DatabaseRow)
  }

  async updateCommunity(change: CommunityUpdateWrite): Promise<{ community: Community; previousPicture: string | null }> {
    const response = await this.fetchWithTimeout(this.baseUrl + '/rest/v1/rpc/nexus_update_community', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_community_id: change.communityId,
        p_name: change.name,
        p_url: change.url,
        p_picture: change.picture,
        p_about: change.about,
        p_privacy: change.privacy,
        p_last_activity_ms: change.lastActivity,
        p_avatar_path: change.avatarPath,
        p_editor_image_ids: [...change.editorImageIds]
      })
    })
    await this.assertSuccess(response)
    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error('Supabase relational community update returned an invalid result.')
    }
    const row = rows[0] as DatabaseRow
    return {
      community: this.mapCommunity(row),
      previousPicture: typeof row.previous_picture === 'string' ? row.previous_picture : null
    }
  }

  async getPublicCommunities(page: number): Promise<PaginatedResult<Community>> {
    const response = await this.fetchWithTimeout(this.baseUrl + '/rest/v1/rpc/nexus_list_public_communities', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_page: page })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) throw new Error('Supabase public community list returned an invalid result.')
    const record = result as Record<string, unknown>
    if (!Array.isArray(record.items) || record.pageSize !== 20 || !Number.isSafeInteger(record.totalItems) || !Number.isSafeInteger(record.totalPages)) {
      throw new Error('Supabase public community list returned invalid pagination data.')
    }
    return result as PaginatedResult<Community>
  }

  async getCommunityByUrl(url: string, userId: string | null): Promise<Community> {
    const response = await this.fetchWithTimeout(this.baseUrl + '/rest/v1/rpc/nexus_get_community_by_url', {
      method: 'POST', headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_url: url, p_user_id: userId })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null || !('id' in result) || !('privacy' in result)) {
      throw new Error('Supabase community lookup returned an invalid result.')
    }
    return result as Community
  }

  async getProfileCommunities(profileId: string, page: number): Promise<PaginatedResult<Community>> {
    const response = await this.fetchWithTimeout(this.baseUrl + '/rest/v1/rpc/nexus_get_profile_communities', {
      method: 'POST', headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_profile_id: profileId, p_page: page })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) throw new Error('Supabase profile communities returned an invalid result.')
    const record = result as Record<string, unknown>
    if (!Array.isArray(record.items) || record.pageSize !== 20 || !Number.isSafeInteger(record.totalItems) || !Number.isSafeInteger(record.totalPages)) {
      throw new Error('Supabase profile communities returned invalid pagination data.')
    }
    return result as PaginatedResult<Community>
  }

  async getCommunityEditPage(url: string, userId: string | null): Promise<CommunityEditPageData> {
    const response = await this.fetchWithTimeout(this.baseUrl + '/rest/v1/rpc/nexus_get_community_edit_page', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_url: url, p_user_id: userId })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null || !('community' in result) || !('ownerProfileId' in result) || !('currentProfileType' in result)) {
      throw new Error('Supabase community edit page returned an invalid result.')
    }
    return result as CommunityEditPageData
  }

  async getCommunityForumComposerPage(url: string, userId: string | null): Promise<CommunityForumComposerPageData> {
    const response = await this.fetchWithTimeout(this.baseUrl + '/rest/v1/rpc/nexus_get_community_forum_composer_page', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_url: url, p_user_id: userId })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null || !('community' in result) || !('forumProfile' in result) || !('viewerRelationship' in result) || !('currentProfileType' in result)) {
      throw new Error('Supabase community forum composer page returned an invalid result.')
    }
    return result as CommunityForumComposerPageData
  }

  async getCommunitiesPage(
    userId: string,
    page: number,
    query: string | undefined,
    sort: ListSort,
    communityTab: 'all' | 'managed'
  ): Promise<CommunitiesPageData> {
    const response = await this.fetchWithTimeout(this.baseUrl + '/rest/v1/rpc/nexus_get_communities_page', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: userId,
        p_page: page,
        p_query: query ?? null,
        p_sort: sort,
        p_community_tab: communityTab
      })
    })
    await this.assertSuccess(response)

    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) {
      throw new Error('Supabase communities page returned an invalid result.')
    }
    const record = result as Record<string, unknown>
    const communities = record.communities as Record<string, unknown> | null
    if (
      !communities || typeof communities !== 'object' ||
      !Array.isArray(communities.items) ||
      (record.communityTab !== 'all' && record.communityTab !== 'managed') ||
      !('currentProfile' in record)
    ) {
      throw new Error('Supabase communities page returned invalid data.')
    }
    const pageResult = result as CommunitiesPageData
    if (
      pageResult.communities.pageSize !== 20 ||
      !Number.isSafeInteger(pageResult.communities.totalItems) ||
      !Number.isSafeInteger(pageResult.communities.totalPages)
    ) {
      throw new Error('Supabase communities page returned invalid pagination metadata.')
    }
    return pageResult
  }

  async getCommunityPage(url: string, userId: string | null): Promise<CommunityPageData> {
    const response = await this.fetchWithTimeout(this.baseUrl + '/rest/v1/rpc/nexus_get_community_page', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_url: url, p_user_id: userId })
    })
    await this.assertSuccess(response)

    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) {
      throw new Error('Supabase community page returned an invalid result.')
    }
    const record = result as Record<string, unknown>
    const members = record.members as Record<string, unknown> | null
    const forumTopics = record.forumTopics as Record<string, unknown> | null
    if (
      !Array.isArray(record.relationships) ||
      !members || typeof members !== 'object' ||
      !Array.isArray(members.items) ||
      !forumTopics || typeof forumTopics !== 'object' ||
      !Array.isArray(forumTopics.items) ||
      !Array.isArray(record.forumAuthors) ||
      typeof record.canViewMembers !== 'boolean' ||
      typeof record.canEditCommunity !== 'boolean' ||
      !Number.isSafeInteger(record.pendingRequestCount)
    ) {
      throw new Error('Supabase community page returned invalid data.')
    }

    const pageResult = result as CommunityPageData
    if (
      pageResult.members.pageSize !== 20 ||
      pageResult.forumTopics.pageSize !== 20 ||
      !Number.isSafeInteger(pageResult.members.totalItems) ||
      !Number.isSafeInteger(pageResult.forumTopics.totalItems)
    ) {
      throw new Error('Supabase community page returned invalid pagination metadata.')
    }
    return pageResult
  }

  async getCommunityMembersPage(
    url: string,
    userId: string | null,
    page: number,
    pendingPage: number,
    query: string | undefined,
    sort: ListSort,
    tab: string | undefined
  ): Promise<CommunityMembersPageData> {
    const response = await this.fetchWithTimeout(this.baseUrl + '/rest/v1/rpc/nexus_get_community_members_page', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_url: url,
        p_user_id: userId,
        p_page: page,
        p_pending_page: pendingPage,
        p_query: query ?? null,
        p_sort: sort,
        p_tab: tab ?? null
      })
    })
    await this.assertSuccess(response)

    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) {
      throw new Error('Supabase community members page returned an invalid result.')
    }
    const record = result as Record<string, unknown>
    const members = record.members as Record<string, unknown> | null
    const pending = record.pending as Record<string, unknown> | null
    if (
      !Array.isArray(record.relationships) ||
      !members || typeof members !== 'object' || !Array.isArray(members.items) ||
      !pending || typeof pending !== 'object' || !Array.isArray(pending.items) ||
      typeof record.isStaff !== 'boolean' ||
      !['all', 'staff', 'banned'].includes(String(record.visibleTab))
    ) {
      throw new Error('Supabase community members page returned invalid data.')
    }
    const pageResult = result as CommunityMembersPageData
    if (
      pageResult.members.pageSize !== 20 ||
      pageResult.pending.pageSize !== 20 ||
      !Number.isSafeInteger(pageResult.members.totalItems) ||
      !Number.isSafeInteger(pageResult.pending.totalItems)
    ) {
      throw new Error('Supabase community members page returned invalid pagination metadata.')
    }
    return pageResult
  }
}
