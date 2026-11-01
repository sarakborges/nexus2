import { create } from 'zustand'

import type { AuthenticatedUser } from '@/Models/User.model'
import type {
  CreateProfileInput,
  Profile
} from '@/Models/Profile.model'
import { getCurrentAuthSession, getUserById } from '@/Services/Auth'
import {
  createUserProfile,
  getProfiles,
  getProfilesByIds
} from '@/Services/Profile'

type ProfileStore = {
  profiles: Profile[]
  profile: Profile | null
  loadProfiles: (user: AuthenticatedUser) => void
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
const initialSession = getCurrentAuthSession()
const initialUser = initialSession
  ? getUserById(initialSession.user.id)
  : null
const initialProfile =
  initialProfiles.find(
    (profile) => profile.id === initialUser?.currentProfile
  ) ?? initialProfiles[0] ?? null

export const useProfileStore = create<ProfileStore>((set) => ({
  profiles: initialProfiles,
  profile: initialProfile,

  loadProfiles: (user) => {
    const profiles = getProfilesByIds(user.profiles)
    const profile =
      profiles.find((item) => item.id === user.currentProfile) ??
      profiles[0] ??
      null

    set({ profiles, profile })
  },

  createProfile: (userId, input) => {
    const createdProfile = createUserProfile(userId, input)
    const user = getUserById(userId)
    const profiles = user ? getProfilesByIds(user.profiles) : []

    set({
      profiles,
      profile:
        profiles.find((item) => item.id === user?.currentProfile) ??
        createdProfile
    })

    return createdProfile
  },

  clearProfiles: () => {
    set({ profiles: [], profile: null })
  }
}))
