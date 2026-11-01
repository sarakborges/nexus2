import { create } from 'zustand'

import { getCurrentAuthSession, getUserById } from '@/Services/Auth'
import { createUserProfile, getProfiles, getProfilesByIds } from '@/Services/Profile'
import type {
  CreateProfileInput,
  Profile
} from '@/Models/Profile.model'

type ProfileStore = {
  profiles: Profile[]
  profile: Profile | null
  loadProfiles: (profileIds: string[]) => void
  createProfile: (userId: string, input: CreateProfileInput) => Profile
  clearProfiles: () => void
}

const initializeProfiles = (): Profile[] => {
  const session = getCurrentAuthSession()

  if (!session) {
    return []
  }

  getProfiles()

  const user = getUserById(session.user.id)

  return user ? getProfilesByIds(user.profiles) : []
}

const initialProfiles = initializeProfiles()

export const useProfileStore = create<ProfileStore>((set) => ({
  profiles: initialProfiles,
  profile: initialProfiles[0] ?? null,

  loadProfiles: (profileIds) => {
    const profiles = getProfilesByIds(profileIds)

    set({
      profiles,
      profile: profiles[0] ?? null
    })
  },

  createProfile: (userId, input) => {
    const profile = createUserProfile(userId, input)

    set((state) => ({
      profiles: [...state.profiles, profile],
      profile
    }))

    return profile
  },

  clearProfiles: () => {
    set({ profiles: [], profile: null })
  }
}))
