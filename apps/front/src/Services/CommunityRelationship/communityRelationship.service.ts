import type { CommunityRelationship, CommunityRelationshipType, PaginatedResult, Profile, PaginationParams } from '@nexus/common'
import { api } from '../Http/api'

export async function getCommunityRelationships(communityId: string): Promise<CommunityRelationship[]> {
  const { data } = await api.get<CommunityRelationship[]>(`/communities/${encodeURIComponent(communityId)}/relationships`)
  return data
}
export async function setCommunityRelationship(profileId: string, communityId: string, type: CommunityRelationshipType, actorProfileId: string): Promise<CommunityRelationship> {
  const { data } = await api.post<CommunityRelationship>(`/communities/${encodeURIComponent(communityId)}/relationships/${encodeURIComponent(profileId)}`, { type, actorProfileId })
  return data
}
export async function removeCommunityRelationship(profileId: string, communityId: string, actorProfileId: string): Promise<void> {
  await api.post(`/communities/${encodeURIComponent(communityId)}/relationships/${encodeURIComponent(profileId)}/remove`, { actorProfileId })
}
export async function demoteCommunityModerator(profileId: string, communityId: string, actorProfileId: string): Promise<void> {
  await api.post(`/communities/${encodeURIComponent(communityId)}/moderators/${encodeURIComponent(profileId)}/demote`, { actorProfileId })
}
export async function transferCommunityOwnership(currentOwnerProfileId: string, newOwnerProfileId: string, communityId: string): Promise<void> {
  await api.post(`/communities/${encodeURIComponent(communityId)}/ownership-transfer`, { actorProfileId: currentOwnerProfileId, newOwnerProfileId })
}
export async function getCommunityMembers(communityId: string, tab: string, params: PaginationParams, actorProfileId?: string): Promise<PaginatedResult<Profile & { role: string }>> {
  const { data } = await api.get<PaginatedResult<Profile & { role: string }>>(`/communities/${encodeURIComponent(communityId)}/members`, {
    params: { ...params, tab, ...(actorProfileId ? { actorProfileId } : {}) }
  })
  return data
}
export async function getPendingCommunityMembers(communityId: string, actorProfileId: string, params: PaginationParams): Promise<PaginatedResult<Profile & { role: string }>> {
  const { data } = await api.get<PaginatedResult<Profile & { role: string }>>(`/communities/${encodeURIComponent(communityId)}/members/pending`, { params: { ...params, actorProfileId } })
  return data
}
