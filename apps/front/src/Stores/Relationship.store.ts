import { create } from 'zustand'
import type { Relationship, RelationshipType } from '@/Models/Relationship.model'
import { getRelationships, removeRelationship, setRelationship } from '@/Services/Relationship'

type RelationshipStore = {
  relationships: Relationship[]
  loadedProfileId: string | null
  loadRelationships: (profileId: string) => Promise<void>
  updateRelationship: (firstId: string, secondId: string, type: RelationshipType, actorId: string) => Promise<boolean>
  removeRelationship: (firstId: string, secondId: string) => Promise<boolean>
  getRelationship: (firstId: string, secondId: string) => Relationship | null
  getRelatedIds: (participantId: string, type?: RelationshipType) => string[]
}
export const useRelationshipStore = create<RelationshipStore>((set, get) => ({
  relationships: [],
  loadedProfileId: null,
  loadRelationships: async (profileId) => {
    const relationships = await getRelationships(profileId)
    set({ relationships, loadedProfileId: profileId })
  },
  updateRelationship: async (firstId, secondId, type, actorId) => {
    try {
      const targetId = actorId === firstId ? secondId : firstId
      const relationship = await setRelationship(actorId, targetId, type)
      set((state) => ({
        relationships: [...state.relationships.filter(item => !(item.profiles.includes(firstId) && item.profiles.includes(secondId))), relationship]
      }))
      return true
    } catch { return false }
  },
  removeRelationship: async (firstId, secondId) => {
    try {
      await removeRelationship(firstId, secondId)
      set((state) => ({ relationships: state.relationships.filter(item => !(item.profiles.includes(firstId) && item.profiles.includes(secondId))) }))
      return true
    } catch { return false }
  },
  getRelationship: (firstId, secondId) => get().relationships.find(item => item.profiles.includes(firstId) && item.profiles.includes(secondId)) ?? null,
  getRelatedIds: (id, type) => get().relationships.filter(item => item.profiles.includes(id) && (!type || item.type === type)).map(item => item.profiles.find(other => other !== id)!).filter(Boolean)
}))
