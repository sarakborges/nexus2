import { api } from '../Http/api'
import type {
  PaginatedResult,
  PaginationParams,
  Profile,
  Relationship,
  RelationshipType
} from '@nexus/common'

export async function getRelationships(
  profileId: string
): Promise<Relationship[]> {
  const { data } = await api.get<Relationship[]>('/relationships', {
    params: { profileId }
  })
  return data
}
export async function getProfileFriends(
  profileId: string,
  params: PaginationParams = {}
): Promise<PaginatedResult<Profile>> {
  const { data } = await api.get<PaginatedResult<Profile>>(
    `/relationships/friends/${encodeURIComponent(profileId)}`,
    { params }
  )
  return data
}
export async function setRelationship(
  sourceProfileId: string,
  targetProfileId: string,
  type: RelationshipType
): Promise<Relationship> {
  const { data } = await api.post<Relationship>('/relationships', {
    sourceProfileId,
    targetProfileId,
    type
  })
  return data
}
export async function removeRelationship(
  sourceProfileId: string,
  targetProfileId: string
): Promise<void> {
  await api.post('/relationships/remove', { sourceProfileId, targetProfileId })
}
