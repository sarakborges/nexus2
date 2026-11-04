import { create } from 'zustand'

import type { Profile } from '@/Models/Profile.model'
import { getProfileByUrl } from '@/Services/Profile'

type ProfileStore = {
  profile: Profile | null
  loadedUrl: string | null
  loadingUrl: string | null
  loadProfileByUrl: (url: string) => Promise<void>
  clearProfile: () => void
}
export const useProfileStore = create<ProfileStore>((set, get) => ({
  profile: null,
  loadedUrl: null,
  loadingUrl: null,
  loadProfileByUrl: async (url) => {
    const normalized = url.trim().replace(/^@/, '').toLowerCase()
    if (!normalized) {
      set({ profile: null, loadedUrl: null, loadingUrl: null })
      return
    }

    set({ profile: null, loadedUrl: null, loadingUrl: normalized })
    const profile = await getProfileByUrl(normalized)
    if (get().loadingUrl === normalized) {
      set({ profile, loadedUrl: normalized, loadingUrl: null })
    }
  },
  clearProfile: () => set({ profile: null, loadedUrl: null, loadingUrl: null })
}))
