export type RelationshipType = 'connection' | 'requested' | 'blocked'

/**
 * The pair contains the IDs of the two participants in the relationship.
 * A participant may be a Profile or a Community.
 */
export type Relationship = {
  profiles: [string, string]
  type: RelationshipType
  updatedAt: number
}
