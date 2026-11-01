import { create } from 'zustand'
import type { CreateProfileInput, Profile } from '@/Models/Profile.model'
import { createUserProfile, getProfileByUrl } from '@/Services/Profile'

type ProfileStore = {
  profile: Profile | null
  loadedUrl: string | null
  loadProfileByUrl: (url: string) => Promise<void>
  createProfile: (userId: string, input: CreateProfileInput) => Promise<Profile>
  clearProfile: () => void
}
export const useProfileStore = create<ProfileStore>((set, get) => ({
  profile: null,
  loadedUrl: null,
  loadProfileByUrl: async (url) => {
    const normalized = url.trim().replace(/^@/, '').toLowerCase()
    set({ profile: null, loadedUrl: normalized })
    const profile = normalized ? await getProfileByUrl(normalized) : null
    if (get().loadedUrl === normalized) set({ profile })
  },
  createProfile: async (_userId, input) => {
    const profile = await createUserProfile(input)
    set({ profile, loadedUrl: profile.url })
    return profile
  },
  clearProfile: () => set({ profile: null, loadedUrl: null })
}))
