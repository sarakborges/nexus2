import { create } from 'zustand'

import { getCurrentAuthSession } from '@/Services/Auth'
import { createUserProfile, getUserProfile } from '@/Services/Profile'
import type {
  CreateProfileInput,
  Profile
} from '@/Models/Profile.model'

type ProfileStore = {
  profile: Profile | null
  loadProfile: (userId: string) => void
  createProfile: (userId: string, input: CreateProfileInput) => Profile
  clearProfile: () => void
}

const currentSession = getCurrentAuthSession()

export const useProfileStore = create<ProfileStore>((set) => ({
  profile: currentSession ? getUserProfile(currentSession.user.id) : null,

  loadProfile: (userId) => {
    set({ profile: getUserProfile(userId) })
  },

  createProfile: (userId, input) => {
    const profile = createUserProfile(userId, input)

    set({ profile })

    return profile
  },

  clearProfile: () => {
    set({ profile: null })
  }
}))
