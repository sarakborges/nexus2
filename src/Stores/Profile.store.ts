import { create } from 'zustand'

import type { CreateProfileInput, Profile } from '@/Models/Profile.model'
import {
  createUserProfile,
  getProfileByUrl,
  getProfiles,
  ProfileError,
  saveProfiles
} from '@/Services/Profile'
import { useUserStore } from '@/Stores/User.store'

type ProfileStore = {
  profile: Profile | null
  loadedUrl: string | null
  loadProfileByUrl: (url: string) => void
  createProfile: (userId: string, input: CreateProfileInput) => Profile
  deleteProfile: (profileId: string) => boolean
  clearProfile: () => void
}

// Run legacy profile migration once, then refresh the user cache updated by it.
// The collection itself is deliberately not retained in this store.
getProfiles()
useUserStore.getState().reloadUsers()

export const useProfileStore = create<ProfileStore>((set) => ({
  profile: null,
  loadedUrl: null,

  loadProfileByUrl: (url) => {
    const normalizedUrl = url.trim().replace(/^@/, '').toLowerCase()

    set({
      profile: normalizedUrl ? getProfileByUrl(normalizedUrl) : null,
      loadedUrl: normalizedUrl
    })
  },

  createProfile: (userId, input) => {
    if (!useUserStore.getState().getUserById(userId)) {
      throw new ProfileError('STORAGE_UNAVAILABLE')
    }

    const existingProfiles = getProfiles()
    const createdProfile = createUserProfile(input, existingProfiles)
    const updatedProfiles = [...existingProfiles, createdProfile]

    if (!saveProfiles(updatedProfiles)) {
      throw new ProfileError('STORAGE_UNAVAILABLE')
    }

    set({ profile: createdProfile, loadedUrl: createdProfile.url })

    return createdProfile
  },

  deleteProfile: (profileId) => {
    const existingProfiles = getProfiles()
    const updatedProfiles = existingProfiles.filter(
      (profile) => profile.id !== profileId
    )

    if (updatedProfiles.length === existingProfiles.length) {
      return true
    }

    if (!saveProfiles(updatedProfiles)) {
      return false
    }

    set((state) =>
      state.profile?.id === profileId
        ? { profile: null, loadedUrl: null }
        : state
    )

    return true
  },

  clearProfile: () => {
    set({ profile: null, loadedUrl: null })
  }
}))
