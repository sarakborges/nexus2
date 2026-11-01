import { loadData, saveData } from '@/Helpers/Systems/Data'
import type {
  CommunityRelationship,
  CommunityRelationshipType
} from '@/Models/CommunityRelationship.model'
import { getCommunities } from '@/Services/Community'
import {
  getRelationships,
  saveRelationships
} from '@/Services/Relationship'

const COMMUNITY_RELATIONSHIPS_KEY = 'community_relationships'
const RELATIONSHIP_TYPES: CommunityRelationshipType[] = [
  'owner',
  'connection',
  'requested',
  'blocked'
]

const samePair = (
  first: [string, string],
  second: [string, string]
): boolean => first[0] === second[0] && first[1] === second[1]

const parseRelationship = (value: unknown): CommunityRelationship | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const relationship = value as Record<string, unknown>
  const profiles = relationship.profiles

  if (
    !Array.isArray(profiles) ||
    profiles.length !== 2 ||
    typeof profiles[0] !== 'string' ||
    typeof profiles[1] !== 'string' ||
    !profiles[0] ||
    !profiles[1] ||
    typeof relationship.type !== 'string' ||
    !RELATIONSHIP_TYPES.includes(
      relationship.type as CommunityRelationshipType
    ) ||
    typeof relationship.updatedAt !== 'number'
  ) {
    return null
  }

  return {
    profiles: [profiles[0], profiles[1]],
    type: relationship.type as CommunityRelationshipType,
    requestedBy:
      typeof relationship.requestedBy === 'string'
        ? relationship.requestedBy
        : null,
    blockedBy:
      typeof relationship.blockedBy === 'string'
        ? relationship.blockedBy
        : null,
    updatedAt: relationship.updatedAt
  }
}

export const getCommunityRelationships = (): CommunityRelationship[] => {
  const storedRelationships = loadData<unknown>(COMMUNITY_RELATIONSHIPS_KEY)

  if (!Array.isArray(storedRelationships)) {
    return []
  }

  const relationships = storedRelationships
    .map(parseRelationship)
    .filter(
      (relationship): relationship is CommunityRelationship =>
        relationship !== null
    )

  if (
    relationships.length !== storedRelationships.length ||
    storedRelationships.some(
      (item) =>
        !item ||
        typeof item !== 'object' ||
        !Object.prototype.hasOwnProperty.call(item, 'requestedBy') ||
        !Object.prototype.hasOwnProperty.call(item, 'blockedBy')
    )
  ) {
    saveCommunityRelationships(relationships)
  }

  return relationships
}

export const saveCommunityRelationships = (
  relationships: CommunityRelationship[]
): boolean =>
  saveData({ key: COMMUNITY_RELATIONSHIPS_KEY, value: relationships })

export const getCommunityRelationship = (
  profileId: string,
  communityId: string,
  relationships: CommunityRelationship[] = getCommunityRelationships()
): CommunityRelationship | null =>
  relationships.find((item) =>
    samePair(item.profiles, [profileId, communityId])
  ) ?? null

export const setCommunityRelationship = (
  profileId: string,
  communityId: string,
  type: CommunityRelationshipType,
  actorProfileId: string,
  relationships: CommunityRelationship[]
): CommunityRelationship[] | null => {
  if (!profileId || !communityId || !actorProfileId) {
    return null
  }

  const isProfileAction = actorProfileId === profileId
  const isCommunityOwner = relationships.some(
    (item) =>
      item.profiles[0] === actorProfileId &&
      item.profiles[1] === communityId &&
      item.type === 'owner'
  )

  if (
    (type === 'owner' && !isProfileAction) ||
    (type === 'requested' && !isProfileAction) ||
    (type !== 'owner' && type !== 'requested' &&
      !isProfileAction && !isCommunityOwner)
  ) {
    return null
  }

  const pair: [string, string] = [profileId, communityId]
  const relationship: CommunityRelationship = {
    profiles: pair,
    type,
    requestedBy: type === 'requested' ? actorProfileId : null,
    blockedBy: type === 'blocked' ? actorProfileId : null,
    updatedAt: Date.now()
  }

  return [
    ...relationships.filter((item) => !samePair(item.profiles, pair)),
    relationship
  ]
}

export const removeCommunityRelationship = (
  profileId: string,
  communityId: string,
  actorProfileId: string,
  relationships: CommunityRelationship[]
): CommunityRelationship[] | null => {
  const isProfileAction = actorProfileId === profileId
  const isCommunityOwner = relationships.some(
    (item) =>
      item.profiles[0] === actorProfileId &&
      item.profiles[1] === communityId &&
      item.type === 'owner'
  )

  if (!profileId || !communityId || (!isProfileAction && !isCommunityOwner)) {
    return null
  }

  return relationships.filter(
    (item) => !samePair(item.profiles, [profileId, communityId])
  )
}


/**
 * Move the profile-community pairs from the earlier mixed relationship
 * collection into their dedicated storage. Legacy actor IDs remain null
 * because the previous format did not record who initiated the action.
 */
export const migrateLegacyCommunityRelationships = (): void => {
  const communityIds = new Set(getCommunities().map((community) => community.id))

  if (communityIds.size === 0) {
    return
  }

  const legacyRelationships = getRelationships()
  const legacyCommunityPairs = legacyRelationships.filter((item) => {
    const communityMatches = item.profiles.filter((id) =>
      communityIds.has(id)
    )

    return communityMatches.length === 1
  })

  if (legacyCommunityPairs.length === 0) {
    return
  }

  const existingRelationships = getCommunityRelationships()
  const migratedRelationships = [...existingRelationships]

  for (const relationship of legacyCommunityPairs) {
    const communityId = relationship.profiles.find((id) =>
      communityIds.has(id)
    )
    const profileId = relationship.profiles.find(
      (id) => !communityIds.has(id)
    )

    if (!profileId || !communityId) {
      continue
    }

    const alreadyMigrated = migratedRelationships.some(
      (item) =>
        item.profiles[0] === profileId &&
        item.profiles[1] === communityId
    )

    if (!alreadyMigrated) {
      migratedRelationships.push({
        profiles: [profileId, communityId],
        type: relationship.type,
        requestedBy: relationship.requestedBy,
        blockedBy: relationship.blockedBy,
        updatedAt: relationship.updatedAt
      })
    }
  }

  if (!saveCommunityRelationships(migratedRelationships)) {
    return
  }

  const remainingRelationships = legacyRelationships.filter(
    (item) =>
      !item.profiles.some((id) => communityIds.has(id))
  )

  if (!saveRelationships(remainingRelationships)) {
    saveCommunityRelationships(existingRelationships)
  }
}
