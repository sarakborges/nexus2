import { create } from 'zustand'

import type {
  Relationship,
  RelationshipType
} from '@/Models/Relationship.model'
import { migrateLegacyCommunityRelationships } from '@/Services/CommunityRelationship'
import {
  getRelationships,
  removeRelationship as buildRelationshipRemoval,
  saveRelationships,
  setRelationship as buildRelationshipUpdate
} from '@/Services/Relationship'

type RelationshipStore = {
  relationships: Relationship[]
  updateRelationship: (
    firstId: string,
    secondId: string,
    type: RelationshipType,
    actorId: string
  ) => boolean
  removeRelationship: (firstId: string, secondId: string) => boolean
  getRelationship: (firstId: string, secondId: string) => Relationship | null
  getRelatedIds: (participantId: string, type?: RelationshipType) => string[]
}

const getOtherParticipant = (
  relationship: Relationship,
  participantId: string
): string | null => {
  if (!relationship.profiles.includes(participantId)) {
    return null
  }

  return relationship.profiles.find((id) => id !== participantId) ?? null
}

migrateLegacyCommunityRelationships()

export const useRelationshipStore = create<RelationshipStore>((set, get) => ({
  relationships: getRelationships(),

  updateRelationship: (firstId, secondId, type, actorId) => {
    const updatedRelationships = buildRelationshipUpdate(
      firstId,
      secondId,
      type,
      actorId,
      get().relationships
    )

    if (!updatedRelationships || !saveRelationships(updatedRelationships)) {
      return false
    }

    set({ relationships: updatedRelationships })

    return true
  },

  removeRelationship: (firstId, secondId) => {
    if (!firstId || !secondId || firstId === secondId) {
      return false
    }

    const previousRelationships = get().relationships
    const updatedRelationships = buildRelationshipRemoval(
      firstId,
      secondId,
      previousRelationships
    )

    if (updatedRelationships.length === previousRelationships.length) {
      return true
    }

    if (!saveRelationships(updatedRelationships)) {
      return false
    }

    set({ relationships: updatedRelationships })

    return true
  },

  getRelationship: (firstId, secondId) => {
    if (!firstId || !secondId || firstId === secondId) {
      return null
    }

    return (
      get().relationships.find(
        (relationship) =>
          relationship.profiles.includes(firstId) &&
          relationship.profiles.includes(secondId)
      ) ?? null
    )
  },

  getRelatedIds: (participantId, type) =>
    get()
      .relationships.filter(
        (relationship) =>
          relationship.profiles.includes(participantId) &&
          (!type || relationship.type === type)
      )
      .map((relationship) =>
        getOtherParticipant(relationship, participantId)
      )
      .filter((id): id is string => id !== null)
}))
