export type CommunityRelationshipType =
  | 'owner'
  | 'moderator'
  | 'connection'
  | 'requested'
  | 'blocked'

export type CommunityRelationship = {
  /** Ordered as [profileId, communityId]. */
  profiles: [string, string]
  type: CommunityRelationshipType
  requestedBy: string | null
  blockedBy: string | null
  updatedAt: number
}
