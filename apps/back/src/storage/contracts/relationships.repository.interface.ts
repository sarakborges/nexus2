import type { CommunityMember, CommunityRelationship, CommunityRelationshipChange, PaginatedResult, ProfileRelationshipRemoval, ProfileRelationshipWrite, Relationship } from '../repository.types'

export interface RelationshipsRepository {
  upsertProfileRelationship(change: ProfileRelationshipWrite): Promise<void>
  removeProfileRelationship(change: ProfileRelationshipRemoval): Promise<void>
  changeCommunityRelationship(change: CommunityRelationshipChange): Promise<void>
  getProfileRelationships(userId: string, profileId: string): Promise<Relationship[]>
  getCommunityRelationships(userId: string | null, communityId: string): Promise<CommunityRelationship[]>
  listCommunityMembers(
    communityId: string,
    tab: string,
    page: number,
    userId: string | null,
    actorProfileId?: string
  ): Promise<PaginatedResult<CommunityMember>>
  listPendingMembers(
    userId: string,
    communityId: string,
    actorProfileId: string,
    page: number
  ): Promise<PaginatedResult<CommunityMember>>
}
