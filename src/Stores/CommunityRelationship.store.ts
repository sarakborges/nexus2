import { create } from 'zustand'

import type {
  CommunityRelationship,
  CommunityRelationshipType
} from '@/Models/CommunityRelationship.model'
import {
  getCommunityRelationships,
  migrateLegacyCommunityRelationships,
  removeCommunityRelationship as buildRemoval,
  saveCommunityRelationships,
  setCommunityRelationship as buildUpdate
} from '@/Services/CommunityRelationship'

type CommunityRelationshipStore = {
  relationships: CommunityRelationship[]
  updateRelationship: (
    profileId: string,
    communityId: string,
    type: CommunityRelationshipType,
    actorProfileId: string
  ) => boolean
  addOwnerRelationship: (
    profileId: string,
    communityId: string
  ) => boolean
  removeRelationship: (
    profileId: string,
    communityId: string,
    actorProfileId: string
  ) => boolean
  getRelationship: (
    profileId: string,
    communityId: string
  ) => CommunityRelationship | null
  getCommunityIdsForProfile: (profileId: string) => string[]
  getMemberProfileIds: (communityId: string) => string[]
  getPendingProfileIds: (communityId: string) => string[]
  getBlockedProfileIds: (communityId: string) => string[]
}

migrateLegacyCommunityRelationships()

export const useCommunityRelationshipStore =
  create<CommunityRelationshipStore>((set, get) => ({
    relationships: getCommunityRelationships(),

    updateRelationship: (profileId, communityId, type, actorProfileId) => {
      const updatedRelationships = buildUpdate(
        profileId,
        communityId,
        type,
        actorProfileId,
        get().relationships
      )

      if (
        !updatedRelationships ||
        !saveCommunityRelationships(updatedRelationships)
      ) {
        return false
      }

      set({ relationships: updatedRelationships })

      return true
    },

    addOwnerRelationship: (profileId, communityId) => {
      const updatedRelationships = buildUpdate(
        profileId,
        communityId,
        'owner',
        profileId,
        get().relationships
      )

      if (
        !updatedRelationships ||
        !saveCommunityRelationships(updatedRelationships)
      ) {
        return false
      }

      set({ relationships: updatedRelationships })

      return true
    },

    removeRelationship: (profileId, communityId, actorProfileId) => {
      if (!profileId || !communityId || !actorProfileId) {
        return false
      }

      const previousRelationships = get().relationships
      const updatedRelationships = buildRemoval(
        profileId,
        communityId,
        actorProfileId,
        previousRelationships
      )

      if (!updatedRelationships) {
        return false
      }

      if (updatedRelationships.length === previousRelationships.length) {
        return true
      }

      if (!saveCommunityRelationships(updatedRelationships)) {
        return false
      }

      set({ relationships: updatedRelationships })

      return true
    },

    getRelationship: (profileId, communityId) =>
      get().relationships.find(
        (item) =>
          item.profiles[0] === profileId && item.profiles[1] === communityId
      ) ?? null,

    getCommunityIdsForProfile: (profileId) =>
      get()
        .relationships.filter(
          (item) =>
            item.profiles[0] === profileId &&
            (item.type === 'owner' || item.type === 'connection')
        )
        .map((item) => item.profiles[1]),

    getMemberProfileIds: (communityId) =>
      get()
        .relationships.filter(
          (item) =>
            item.profiles[1] === communityId &&
            (item.type === 'owner' || item.type === 'connection')
        )
        .map((item) => item.profiles[0]),

    getPendingProfileIds: (communityId) =>
      get()
        .relationships.filter(
          (item) =>
            item.profiles[1] === communityId && item.type === 'requested'
        )
        .map((item) => item.profiles[0]),

    getBlockedProfileIds: (communityId) =>
      get()
        .relationships.filter(
          (item) =>
            item.profiles[1] === communityId && item.type === 'blocked'
        )
        .map((item) => item.profiles[0])
  }))
