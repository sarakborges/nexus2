import { create } from 'zustand'

import { getCurrentAuthSession } from '@/Services/Auth'
import {
  createUserProfile,
  getProfiles,
  ProfileError,
  saveProfiles
} from '@/Services/Profile'
import type { AuthenticatedUser } from '@/Models/User.model'
import type { CreateProfileInput, Profile } from '@/Models/Profile.model'
import { useUserStore } from '@/Stores/User.store'

type ProfileStore = {
  allProfiles: Profile[]
  profiles: Profile[]
  profile: Profile | null
  loadProfiles: (user: AuthenticatedUser) => void
  createProfile: (userId: string, input: CreateProfileInput) => Profile
  deleteProfile: (profileId: string) => boolean
  clearProfiles: () => void
}

const initialAllProfiles = getProfiles()
const initialUsers = useUserStore.getState().reloadUsers()
const initialSession = getCurrentAuthSession(initialUsers)
const initialUser = initialSession
  ? initialUsers.find((user) => user.id === initialSession.user.id)
  : null
const initialUserProfileIds = new Set(initialUser?.profiles ?? [])
const initialProfiles = initialAllProfiles.filter((profile) =>
  initialUserProfileIds.has(profile.id)
)
const initialProfile =
  initialProfiles.find(
    (profile) => profile.id === initialUser?.currentProfile
  ) ?? initialProfiles[0] ?? null

export const useProfileStore = create<ProfileStore>((set, get) => ({
  allProfiles: initialAllProfiles,
  profiles: initialProfiles,
  profile: initialProfile,

  loadProfiles: (user) => {
    const profileIds = new Set(user.profiles)
    const profiles = get().allProfiles.filter((item) =>
      profileIds.has(item.id)
    )
    const profile =
      profiles.find((item) => item.id === user.currentProfile) ??
      profiles[0] ??
      null

    set({ profiles, profile })
  },

  createProfile: (userId, input) => {
    if (!useUserStore.getState().getUserById(userId)) {
      throw new ProfileError('STORAGE_UNAVAILABLE')
    }

    const currentProfiles = get().allProfiles
    const createdProfile = createUserProfile(input, currentProfiles)
    const updatedProfiles = [...currentProfiles, createdProfile]

    if (!saveProfiles(updatedProfiles)) {
      throw new ProfileError('STORAGE_UNAVAILABLE')
    }

    set({ allProfiles: updatedProfiles })

    return createdProfile
  },

  deleteProfile: (profileId) => {
    const { allProfiles } = get()
    const updatedProfiles = allProfiles.filter(
      (profile) => profile.id !== profileId
    )

    if (updatedProfiles.length === allProfiles.length) {
      return true
    }

    if (!saveProfiles(updatedProfiles)) {
      return false
    }

    set((state) => ({
      allProfiles: updatedProfiles,
      profiles: state.profiles.filter((profile) => profile.id !== profileId),
      profile:
        state.profile?.id === profileId
          ? state.profiles.find((profile) => profile.id !== profileId) ?? null
          : state.profile
    }))

    return true
  },

  clearProfiles: () => {
    set({ profiles: [], profile: null })
  }
}))
