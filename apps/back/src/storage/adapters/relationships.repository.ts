import type { CommunityMember, CommunityRelationship, CommunityRelationshipChange, PaginatedResult, ProfileRelationshipRemoval, ProfileRelationshipWrite, Relationship } from '../repository.types'
import { SupabaseRepositoryClient } from '../supabase-repository.client'
import type { RelationshipsRepository } from '../contracts/relationships.repository.interface'

export class SupabaseRelationshipsRepository extends SupabaseRepositoryClient implements RelationshipsRepository {
  constructor(projectUrl: string, publishableKey: string, apiSecret: string) {
    super(projectUrl, publishableKey, apiSecret)
  }

  async upsertProfileRelationship(change: ProfileRelationshipWrite): Promise<void> {
    const response = await this.fetchWithTimeout(this.baseUrl + '/rest/v1/rpc/nexus_upsert_profile_relationship', {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_source_profile_id: change.sourceProfileId,
        p_target_profile_id: change.targetProfileId,
        p_type: change.type,
        p_updated_at_ms: change.updatedAt
      })
    })
    await this.assertSuccess(response)
  }

  async removeProfileRelationship(change: ProfileRelationshipRemoval): Promise<void> {
    const response = await this.fetchWithTimeout(this.baseUrl + '/rest/v1/rpc/nexus_remove_profile_relationship', {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_source_profile_id: change.sourceProfileId,
        p_target_profile_id: change.targetProfileId,
        p_updated_at_ms: change.updatedAt
      })
    })
    await this.assertSuccess(response)
  }

  async changeCommunityRelationship(change: CommunityRelationshipChange): Promise<void> {
    const response = await this.fetchWithTimeout(this.baseUrl + '/rest/v1/rpc/nexus_change_community_relationship', {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_community_id: change.communityId,
        p_target_profile_id: change.targetProfileId,
        p_actor_profile_id: change.actorProfileId,
        p_action: change.action,
        p_updated_at_ms: change.updatedAt
      })
    })
    await this.assertSuccess(response)
  }

  async getProfileRelationships(userId: string, profileId: string): Promise<Relationship[]> {
    const response = await this.fetchWithTimeout(this.baseUrl + '/rest/v1/rpc/nexus_get_profile_relationships', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_user_id: userId, p_profile_id: profileId })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (!Array.isArray(result)) throw new Error('Supabase profile relationships returned an invalid result.')
    return result as Relationship[]
  }

  async getCommunityRelationships(userId: string | null, communityId: string): Promise<CommunityRelationship[]> {
    const response = await this.fetchWithTimeout(this.baseUrl + '/rest/v1/rpc/nexus_get_community_relationships', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_user_id: userId, p_community_id: communityId })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (!Array.isArray(result)) throw new Error('Supabase community relationships returned an invalid result.')
    return result as CommunityRelationship[]
  }

  async listCommunityMembers(
    communityId: string,
    tab: string,
    page: number,
    userId: string | null,
    actorProfileId?: string
  ): Promise<PaginatedResult<CommunityMember>> {
    const response = await this.fetchWithTimeout(this.baseUrl + '/rest/v1/rpc/nexus_list_community_members', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_community_id: communityId,
        p_tab: tab,
        p_user_id: userId,
        p_actor_profile_id: actorProfileId ?? null,
        p_page: page
      })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) throw new Error('Supabase community members returned an invalid result.')
    const record = result as Record<string, unknown>
    if (!Array.isArray(record.items) || record.pageSize !== 20 || !Number.isSafeInteger(record.totalItems) || !Number.isSafeInteger(record.totalPages)) {
      throw new Error('Supabase community members returned invalid pagination data.')
    }
    return result as PaginatedResult<CommunityMember>
  }

  async listPendingMembers(
    userId: string,
    communityId: string,
    actorProfileId: string,
    page: number
  ): Promise<PaginatedResult<CommunityMember>> {
    const response = await this.fetchWithTimeout(this.baseUrl + '/rest/v1/rpc/nexus_list_pending_members', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_user_id: userId,
        p_community_id: communityId,
        p_actor_profile_id: actorProfileId,
        p_page: page
      })
    })
    await this.assertSuccess(response)
    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) throw new Error('Supabase pending members returned an invalid result.')
    const record = result as Record<string, unknown>
    if (!Array.isArray(record.items) || record.pageSize !== 20 || !Number.isSafeInteger(record.totalItems) || !Number.isSafeInteger(record.totalPages)) {
      throw new Error('Supabase pending members returned invalid pagination data.')
    }
    return result as PaginatedResult<CommunityMember>
  }
}
