import { create } from 'zustand'
import type { Community, CreateCommunityInput } from '@/Models/Community.model'
import { createCommunity, getCommunityByUrl } from '@/Services/Community'

type CommunityStore = {
  community: Community | null
  loadedUrl: string | null
  loadCommunityByUrl: (url: string) => Promise<void>
  createCommunity: (input: CreateCommunityInput, ownerProfileId: string) => Promise<Community>
  clearCommunity: () => void
}
export const useCommunityStore = create<CommunityStore>((set, get) => ({
  community: null,
  loadedUrl: null,
  loadCommunityByUrl: async (url) => {
    const normalized = url.trim().replace(/^@/, '').toLowerCase()
    set({ community: null, loadedUrl: normalized })
    const community = normalized ? await getCommunityByUrl(normalized) : null
    if (get().loadedUrl === normalized) set({ community })
  },
  createCommunity: async (input, ownerProfileId) => {
    const community = await createCommunity(input, ownerProfileId)
    set({ community, loadedUrl: community.url })
    return community
  },
  clearCommunity: () => set({ community: null, loadedUrl: null })
}))
