export type RelationshipType = 'connection' | 'requested' | 'blocked'

export type Relationship = {
  profiles: [string, string]
  type: RelationshipType
  requestedBy: string | null
  blockedBy: string | null
  updatedAt: number
}
