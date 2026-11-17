import type { AuthenticatedUser, ListSort, PaginatedResult, Profile, ProfileCreateWrite, ProfileDirectoryPageData, ProfileEditPageData, ProfilePageData, ProfilePost, ProfileSettings, ProfileUpdateWrite } from '../repository.types'
import { SupabaseRepositoryClient } from '../supabase-repository.client'
import type { DatabaseRow } from '../supabase-repository.client'
import type { ProfilesRepository } from '../contracts/profiles.repository.interface'

export class SupabaseProfilesRepository extends SupabaseRepositoryClient implements ProfilesRepository {
  constructor(projectUrl: string, publishableKey: string, apiSecret: string) {
    super(projectUrl, publishableKey, apiSecret)
  }

  async getProfilesByIds(ids: readonly string[]): Promise<Profile[]> {
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length === 0) return []
    return (await this.selectRowsByValues('profiles', 'id', uniqueIds)).map(row => ({
      id: this.string(row.id),
      name: this.string(row.name),
      url: this.string(row.url),
      picture: this.string(row.picture),
      about: this.string(row.about),
      type: this.string(row.type) as Profile['type'],
      createdAt: this.number(row.created_at_ms),
      lastActivity: this.number(row.last_activity_ms)
    }))
  }

  async createProfile(change: ProfileCreateWrite): Promise<AuthenticatedUser> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_create_profile', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_profile_id: change.profile.id,
        p_name: change.profile.name,
        p_url: change.profile.url,
        p_picture: change.profile.picture,
        p_about: change.profile.about,
        p_type: change.profile.type,
        p_created_at_ms: change.profile.createdAt,
        p_avatar_path: change.avatarPath,
        p_editor_image_ids: [...change.editorImageIds]
      })
    })
    await this.assertSuccess(response)
    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error('Supabase relational profile creation returned an invalid result.')
    }
    const row = rows[0] as DatabaseRow
    if (
      typeof row.account_id !== 'string' ||
      typeof row.email !== 'string' ||
      !Array.isArray(row.profiles) ||
      !row.profiles.every(profileId => typeof profileId === 'string') ||
      (row.current_profile_id !== null && typeof row.current_profile_id !== 'string')
    ) {
      throw new Error('Supabase relational profile creation returned an invalid account row.')
    }
    return {
      id: row.account_id,
      email: row.email,
      profiles: row.profiles as string[],
      currentProfile: row.current_profile_id as string | null
    }
  }

  async updateProfile(change: ProfileUpdateWrite): Promise<{ profile: Profile; previousPicture: string | null }> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_update_profile', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_profile_id: change.profileId,
        p_name: change.name,
        p_url: change.url,
        p_picture: change.picture,
        p_about: change.about,
        p_last_activity_ms: change.lastActivity,
        p_avatar_path: change.avatarPath,
        p_editor_image_ids: [...change.editorImageIds]
      })
    })
    await this.assertSuccess(response)
    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error('Supabase relational profile update returned an invalid result.')
    }
    const row = rows[0] as DatabaseRow
    return {
      profile: this.mapProfile(row),
      previousPicture: typeof row.previous_picture === 'string' ? row.previous_picture : null
    }
  }

  async createProfilePost(
    userId: string,
    post: ProfilePost,
    imageIds: readonly string[]
  ): Promise<ProfilePost> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_create_profile_post', {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_post_id: post.id,
        p_profile_id: post.profileId,
        p_content: post.content,
        p_created_at_ms: post.createdAt,
        p_image_ids: [...imageIds]
      })
    })
    await this.assertSuccess(response)

    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error('Supabase relational profile post write returned an invalid result.')
    }
    const row = rows[0] as Record<string, unknown>
    if (
      typeof row.id !== 'string' ||
      typeof row.profile_id !== 'string' ||
      typeof row.content !== 'string' ||
      !Number.isFinite(Number(row.created_at_ms))
    ) {
      throw new Error('Supabase relational profile post write returned an invalid row.')
    }
    return {
      id: row.id,
      profileId: row.profile_id,
      content: row.content,
      createdAt: Number(row.created_at_ms)
    }
  }

  async getProfileSettings(userId: string, profileId: string): Promise<ProfileSettings> {
    return this.requestProfileSettings('nexus_get_profile_settings', {
      p_user_id: userId,
      p_profile_id: profileId
    })
  }

  async updateProfileSettings(
    userId: string,
    profileId: string,
    patch: Partial<ProfileSettings>
  ): Promise<ProfileSettings> {
    return this.requestProfileSettings('nexus_update_profile_settings', {
      p_user_id: userId,
      p_profile_id: profileId,
      p_patch: patch
    })
  }

  async getProfilesPage(page: number): Promise<PaginatedResult<Profile>> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_list_profiles', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_page: page })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) throw new Error('Supabase profile list returned an invalid result.')
    const record = result as Record<string, unknown>
    if (!Array.isArray(record.items) || record.pageSize !== 20 || !Number.isSafeInteger(record.totalItems) || !Number.isSafeInteger(record.totalPages)) {
      throw new Error('Supabase profile list returned invalid pagination data.')
    }
    return result as PaginatedResult<Profile>
  }

  async getProfileByUrl(url: string): Promise<Profile> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_profile_by_url', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_url: url })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null || !('id' in result) || !('type' in result)) {
      throw new Error('Supabase profile lookup returned an invalid result.')
    }
    return result as Profile
  }

  async getOwnedProfiles(userId: string, page: number): Promise<PaginatedResult<Profile>> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_owned_profiles', {
      method: 'POST', headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_user_id: userId, p_page: page })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) throw new Error('Supabase owned profiles returned an invalid result.')
    const record = result as Record<string, unknown>
    if (!Array.isArray(record.items) || record.pageSize !== 20 || !Number.isSafeInteger(record.totalItems) || !Number.isSafeInteger(record.totalPages)) {
      throw new Error('Supabase owned profiles returned invalid pagination data.')
    }
    return result as PaginatedResult<Profile>
  }

  async getProfileFriends(profileId: string, page: number): Promise<PaginatedResult<Profile>> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_profile_friends', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_profile_id: profileId, p_page: page })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) throw new Error('Supabase profile friends returned an invalid result.')
    const record = result as Record<string, unknown>
    if (!Array.isArray(record.items) || record.pageSize !== 20 || !Number.isSafeInteger(record.totalItems) || !Number.isSafeInteger(record.totalPages)) {
      throw new Error('Supabase profile friends returned invalid pagination data.')
    }
    return result as PaginatedResult<Profile>
  }

  async getProfileEditPage(url: string, userId: string | null): Promise<ProfileEditPageData> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_profile_edit_page', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_url: url, p_user_id: userId })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null || !('profile' in result) || !('currentProfileType' in result)) {
      throw new Error('Supabase profile edit page returned an invalid result.')
    }
    return result as ProfileEditPageData
  }

  async getProfileDirectoryPage(
    url: string,
    kind: 'friends' | 'communities',
    userId: string | null,
    page: number,
    query: string | undefined,
    sort: ListSort
  ): Promise<ProfileDirectoryPageData> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_profile_directory_page', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_url: url,
        p_kind: kind,
        p_user_id: userId,
        p_page: page,
        p_query: query ?? null,
        p_sort: sort
      })
    })
    await this.assertSuccess(response)

    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) {
      throw new Error('Supabase profile directory page returned an invalid result.')
    }
    const record = result as Record<string, unknown>
    if (
      record.kind !== kind ||
      !('profile' in record) ||
      !('viewerRelationship' in record) ||
      !('currentProfileType' in record)
    ) {
      throw new Error('Supabase profile directory page returned invalid identity data.')
    }

    if (kind === 'friends') {
      const friends = record.friends as Record<string, unknown> | null
      if (
        !Array.isArray(record.friendRelationships) ||
        !friends || typeof friends !== 'object' ||
        !Array.isArray(friends.items)
      ) {
        throw new Error('Supabase friends directory returned invalid data.')
      }
      const pageResult = result as Extract<ProfileDirectoryPageData, { kind: 'friends' }>
      if (
        pageResult.friends.pageSize !== 20 ||
        !Number.isSafeInteger(pageResult.friends.totalItems) ||
        !Number.isSafeInteger(pageResult.friends.totalPages)
      ) {
        throw new Error('Supabase friends directory returned invalid pagination metadata.')
      }
      return pageResult
    }

    const communities = record.communities as Record<string, unknown> | null
    if (!communities || typeof communities !== 'object' || !Array.isArray(communities.items)) {
      throw new Error('Supabase communities directory returned invalid data.')
    }
    const pageResult = result as Extract<ProfileDirectoryPageData, { kind: 'communities' }>
    if (
      pageResult.communities.pageSize !== 20 ||
      !Number.isSafeInteger(pageResult.communities.totalItems) ||
      !Number.isSafeInteger(pageResult.communities.totalPages)
    ) {
      throw new Error('Supabase communities directory returned invalid pagination metadata.')
    }
    return pageResult
  }

  async getProfilePage(url: string, userId: string | null): Promise<ProfilePageData> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/nexus_get_profile_page', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_url: url, p_user_id: userId })
    })
    await this.assertSuccess(response)

    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) {
      throw new Error('Supabase profile page returned an invalid result.')
    }
    const resultRecord = result as Record<string, unknown>
    const friendsPage = resultRecord.friends as Record<string, unknown> | null
    const communitiesPage = resultRecord.communities as Record<string, unknown> | null
    if (
      !friendsPage || typeof friendsPage !== 'object' ||
      !communitiesPage || typeof communitiesPage !== 'object' ||
      !Array.isArray(friendsPage.items) ||
      !Array.isArray(communitiesPage.items)
    ) {
      throw new Error('Supabase profile page returned an invalid result.')
    }
    const pageResult = result as ProfilePageData
    if (
      pageResult.friends.pageSize !== 20 ||
      pageResult.communities.pageSize !== 20 ||
      !Number.isSafeInteger(pageResult.friends.totalItems) ||
      !Number.isSafeInteger(pageResult.communities.totalItems)
    ) {
      throw new Error('Supabase profile page returned invalid pagination data.')
    }
    return pageResult
  }

  private async requestProfileSettings(
    rpcName: string,
    body: Record<string, unknown>
  ): Promise<ProfileSettings> {
    const response = await fetch(this.baseUrl + '/rest/v1/rpc/' + rpcName, {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    await this.assertSuccess(response)

    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error('Supabase profile settings RPC returned an invalid result.')
    }
    const row = rows[0] as Record<string, unknown>
    const allowed = new Set([
      'friend_connected',
      'profile_post',
      'community_created',
      'community_membership'
    ])
    if (
      (row.message_audience !== 'friends' && row.message_audience !== 'everyone') ||
      !Array.isArray(row.publish_activity_types) ||
      !row.publish_activity_types.every(item => typeof item === 'string' && allowed.has(item)) ||
      !Array.isArray(row.show_friend_activity_types) ||
      !row.show_friend_activity_types.every(item => typeof item === 'string' && allowed.has(item))
    ) {
      throw new Error('Supabase profile settings RPC returned an invalid settings row.')
    }

    return {
      messageAudience: row.message_audience,
      publishActivityTypes: row.publish_activity_types as ProfileSettings['publishActivityTypes'],
      showFriendActivityTypes: row.show_friend_activity_types as ProfileSettings['showFriendActivityTypes']
    }
  }
}
