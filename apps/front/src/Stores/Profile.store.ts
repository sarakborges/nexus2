import { create } from 'zustand'
import type { CreateProfileInput, Profile } from '@/Models/Profile.model'
import { createUserProfile, getProfileByUrl } from '@/Services/Profile'

type ProfileStore = {
  profile: Profile | null
  loadedUrl: string | null
  loadingUrl: string | null
  loadProfileByUrl: (url: string) => Promise<void>
  createProfile: (userId: string, input: CreateProfileInput) => Promise<Profile>
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
  createProfile: async (_userId, input) => {
    const profile = await createUserProfile(input)
    set({ profile, loadedUrl: profile.url, loadingUrl: null })
    return profile
  },
  clearProfile: () => set({ profile: null, loadedUrl: null, loadingUrl: null })
}))
