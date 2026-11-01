import { create } from 'zustand'

import type {
  Community,
  CreateCommunityInput
} from '@/Models/Community.model'
import {
  CommunityError,
  createCommunity,
  getCommunityByUrl,
  getCommunities,
  saveCommunities
} from '@/Services/Community'
import { useCommunityRelationshipStore } from '@/Stores/CommunityRelationship.store'

type CommunityStore = {
  community: Community | null
  loadedUrl: string | null
  loadCommunityByUrl: (url: string) => void
  createCommunity: (
    input: CreateCommunityInput,
    ownerProfileId: string
  ) => Community
  clearCommunity: () => void
}

export const useCommunityStore = create<CommunityStore>((set) => ({
  community: null,
  loadedUrl: null,

  loadCommunityByUrl: (url) => {
    const normalizedUrl = url.trim().replace(/^@/, '').toLowerCase()

    set({
      community: normalizedUrl ? getCommunityByUrl(normalizedUrl) : null,
      loadedUrl: normalizedUrl
    })
  },

  createCommunity: (input, ownerProfileId) => {
    if (!ownerProfileId) {
      throw new CommunityError('OWNER_PROFILE_REQUIRED')
    }

    const existingCommunities = getCommunities()
    const community = createCommunity(input, existingCommunities)
    const updatedCommunities = [...existingCommunities, community]

    if (!saveCommunities(updatedCommunities)) {
      throw new CommunityError('STORAGE_UNAVAILABLE')
    }

    if (
      !useCommunityRelationshipStore
        .getState()
        .addOwnerRelationship(ownerProfileId, community.id)
    ) {
      saveCommunities(existingCommunities)
      throw new CommunityError('STORAGE_UNAVAILABLE')
    }

    set({ community, loadedUrl: community.url })

    return community
  },

  clearCommunity: () => {
    set({ community: null, loadedUrl: null })
  }
}))
