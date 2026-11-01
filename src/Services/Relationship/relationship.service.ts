import { loadData, saveData } from '@/Helpers/Systems/Data'
import type {
  Relationship,
  RelationshipType
} from '@/Models/Relationship.model'

const RELATIONSHIPS_KEY = 'relationships'
const RELATIONSHIP_TYPES: RelationshipType[] = [
  'connection',
  'requested',
  'blocked'
]

const normalizePair = (firstId: string, secondId: string): [string, string] =>
  [firstId, secondId].sort() as [string, string]

const samePair = (
  first: [string, string],
  second: [string, string]
): boolean => first[0] === second[0] && first[1] === second[1]

const parseRelationship = (value: unknown): Relationship | null => {
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
    profiles[0] === profiles[1] ||
    typeof relationship.type !== 'string' ||
    !RELATIONSHIP_TYPES.includes(relationship.type as RelationshipType) ||
    typeof relationship.updatedAt !== 'number'
  ) {
    return null
  }

  return {
    profiles: normalizePair(profiles[0], profiles[1]),
    type: relationship.type as RelationshipType,
    updatedAt: relationship.updatedAt
  }
}

export const getRelationships = (): Relationship[] => {
  const storedRelationships = loadData<unknown>(RELATIONSHIPS_KEY)

  if (!Array.isArray(storedRelationships)) {
    return []
  }

  const relationships = storedRelationships
    .map(parseRelationship)
    .filter((relationship): relationship is Relationship => relationship !== null)

  if (relationships.length !== storedRelationships.length) {
    saveRelationships(relationships)
  }

  return relationships
}

export const saveRelationships = (
  relationships: Relationship[]
): boolean => saveData({ key: RELATIONSHIPS_KEY, value: relationships })

export const getRelationship = (
  firstId: string,
  secondId: string,
  relationships: Relationship[] = getRelationships()
): Relationship | null => {
  if (!firstId || !secondId || firstId === secondId) {
    return null
  }

  const pair = normalizePair(firstId, secondId)

  return relationships.find((item) => samePair(item.profiles, pair)) ?? null
}

export const setRelationship = (
  firstId: string,
  secondId: string,
  type: RelationshipType,
  relationships: Relationship[]
): Relationship[] | null => {
  if (!firstId || !secondId || firstId === secondId) {
    return null
  }

  const pair = normalizePair(firstId, secondId)
  const relationship: Relationship = {
    profiles: pair,
    type,
    updatedAt: Date.now()
  }

  return [
    ...relationships.filter((item) => !samePair(item.profiles, pair)),
    relationship
  ]
}

export const removeRelationship = (
  firstId: string,
  secondId: string,
  relationships: Relationship[]
): Relationship[] => {
  const pair = normalizePair(firstId, secondId)

  return relationships.filter((item) => !samePair(item.profiles, pair))
}
