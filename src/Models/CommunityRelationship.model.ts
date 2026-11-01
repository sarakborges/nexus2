export type CommunityRelationshipType =
  | 'owner'
  | 'connection'
  | 'requested'
  | 'blocked'

/**
 * The pair is ordered: profiles[0] is the Profile ID and
 * profiles[1] is the Community ID.
 */
export type CommunityRelationship = {
  profiles: [string, string]
  type: CommunityRelationshipType
  requestedBy: string | null
  blockedBy: string | null
  updatedAt: number
}
