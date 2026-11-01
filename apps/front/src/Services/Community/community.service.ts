import type { Community, CreateCommunityInput, PaginatedResult, PaginationParams } from '@nexus/common'
import { api } from '../Http/api'

export async function getCommunities(params: PaginationParams = {}): Promise<PaginatedResult<Community>> {
  const { data } = await api.get<PaginatedResult<Community>>('/communities', { params })
  return data
}
export async function getCommunitiesByIds(ids: string[]): Promise<Community[]> {
  if (!ids.length) return []
  const { data } = await api.get<Community[]>('/communities/ids', { params: { ids } })
  return data
}
export async function getCommunityByUrl(url: string): Promise<Community | null> {
  try { const { data } = await api.get<Community>(`/communities/by-url/${encodeURIComponent(url)}`); return data }
  catch { return null }
}
export async function createCommunity(input: CreateCommunityInput, ownerProfileId: string): Promise<Community> {
  const { data } = await api.post<Community>('/communities', { ...input, ownerProfileId })
  return data
}
export async function getProfileCommunities(profileId: string, params: PaginationParams = {}) {
  const { data } = await api.get<PaginatedResult<Community>>(`/communities/profile/${encodeURIComponent(profileId)}`, { params })
  return data
}
