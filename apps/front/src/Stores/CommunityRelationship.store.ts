import { create } from 'zustand'

import type {
  CommunityRelationship,
  CommunityRelationshipType
} from '@/Models/CommunityRelationship.model'
import {
  demoteCommunityModerator,
  getCommunityRelationships,
  removeCommunityRelationship,
  setCommunityRelationship,
  transferCommunityOwnership
} from '@/Services/CommunityRelationship'

type CommunityRelationshipStore = {
  relationships: CommunityRelationship[]
  loadedCommunityId: string | null
  loadRelationships: (communityId: string) => Promise<void>
  updateRelationship: (
    profileId: string,
    communityId: string,
    type: CommunityRelationshipType,
    actorProfileId: string
  ) => Promise<boolean>
  addOwnerRelationship: (profileId: string, communityId: string) => boolean
  demoteModerator: (
    profileId: string,
    communityId: string,
    actorProfileId: string
  ) => Promise<boolean>
  transferOwnership: (
    currentOwnerProfileId: string,
    newOwnerProfileId: string,
    communityId: string
  ) => Promise<boolean>
  removeRelationship: (
    profileId: string,
    communityId: string,
    actorProfileId: string
  ) => Promise<boolean>
  getRelationship: (
    profileId: string,
    communityId: string
  ) => CommunityRelationship | null
  getCommunityIdsForProfile: (profileId: string) => string[]
  getMemberProfileIds: (communityId: string) => string[]
  getStaffProfileIds: (communityId: string) => string[]
  getPendingProfileIds: (communityId: string) => string[]
  getBlockedProfileIds: (communityId: string) => string[]
}
export const useCommunityRelationshipStore = create<CommunityRelationshipStore>(
  (set, get) => ({
    relationships: [],
    loadedCommunityId: null,
    loadRelationships: async (communityId) => {
      const relationships = await getCommunityRelationships(communityId)
      set({ relationships, loadedCommunityId: communityId })
    },
    updateRelationship: async (
      profileId,
      communityId,
      type,
      actorProfileId
    ) => {
      try {
        const relationship = await setCommunityRelationship(
          profileId,
          communityId,
          type,
          actorProfileId
        )
        set((state) => ({
          relationships: [
            ...state.relationships.filter(
              (item) =>
                !(
                  item.profiles[0] === profileId &&
                  item.profiles[1] === communityId
                )
            ),
            relationship
          ],
          loadedCommunityId: communityId
        }))
        return true
      } catch {
        return false
      }
    },
    addOwnerRelationship: () => false,
    demoteModerator: async (profileId, communityId, actorProfileId) => {
      try {
        await demoteCommunityModerator(profileId, communityId, actorProfileId)
        set((state) => ({
          relationships: state.relationships.map((item) =>
            item.profiles[0] === profileId && item.profiles[1] === communityId
              ? { ...item, type: 'connection', updatedAt: Date.now() }
              : item
          )
        }))
        return true
      } catch {
        return false
      }
    },
    transferOwnership: async (
      currentOwnerProfileId,
      newOwnerProfileId,
      communityId
    ) => {
      try {
        await transferCommunityOwnership(
          currentOwnerProfileId,
          newOwnerProfileId,
          communityId
        )
        set((state) => ({
          relationships: state.relationships.map((item) => {
            if (item.profiles[1] !== communityId) return item
            if (item.profiles[0] === currentOwnerProfileId)
              return { ...item, type: 'moderator', updatedAt: Date.now() }
            if (item.profiles[0] === newOwnerProfileId)
              return { ...item, type: 'owner', updatedAt: Date.now() }
            return item
          })
        }))
        return true
      } catch {
        return false
      }
    },
    removeRelationship: async (profileId, communityId, actorProfileId) => {
      try {
        await removeCommunityRelationship(
          profileId,
          communityId,
          actorProfileId
        )
        set((state) => ({
          relationships: state.relationships.filter(
            (item) =>
              !(
                item.profiles[0] === profileId &&
                item.profiles[1] === communityId
              )
          )
        }))
        return true
      } catch {
        return false
      }
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
            ['owner', 'moderator', 'connection'].includes(item.type)
        )
        .map((item) => item.profiles[1]),
    getMemberProfileIds: (communityId) =>
      get()
        .relationships.filter(
          (item) =>
            item.profiles[1] === communityId &&
            ['owner', 'moderator', 'connection'].includes(item.type)
        )
        .map((item) => item.profiles[0]),
    getStaffProfileIds: (communityId) =>
      get()
        .relationships.filter(
          (item) =>
            item.profiles[1] === communityId &&
            ['owner', 'moderator'].includes(item.type)
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
          (item) => item.profiles[1] === communityId && item.type === 'blocked'
        )
        .map((item) => item.profiles[0])
  })
)
