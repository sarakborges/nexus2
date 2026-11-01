import { create } from 'zustand'
import type { Community, CreateCommunityInput } from '@/Models/Community.model'
import { createCommunity, getCommunityByUrl } from '@/Services/Community'

type CommunityStore = {
  community: Community | null
  loadedUrl: string | null
  loadingUrl: string | null
  loadCommunityByUrl: (url: string) => Promise<void>
  createCommunity: (input: CreateCommunityInput, ownerProfileId: string) => Promise<Community>
  clearCommunity: () => void
}
export const useCommunityStore = create<CommunityStore>((set, get) => ({
  community: null,
  loadedUrl: null,
  loadingUrl: null,
  loadCommunityByUrl: async (url) => {
    const normalized = url.trim().replace(/^@/, '').toLowerCase()
    if (!normalized) {
      set({ community: null, loadedUrl: null, loadingUrl: null })
      return
    }

    set({ community: null, loadedUrl: null, loadingUrl: normalized })
    const community = await getCommunityByUrl(normalized)
    if (get().loadingUrl === normalized) {
      set({ community, loadedUrl: normalized, loadingUrl: null })
    }
  },
  createCommunity: async (input, ownerProfileId) => {
    const community = await createCommunity(input, ownerProfileId)
    set({ community, loadedUrl: community.url, loadingUrl: null })
    return community
  },
  clearCommunity: () => set({ community: null, loadedUrl: null, loadingUrl: null })
}))
