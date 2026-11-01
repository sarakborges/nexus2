import { ProfileModel } from '@/Models/Profile.model'
import { create } from 'zustand'

import type { ProfileType } from '@/Types/Profile.type'

type ProfileStore = {
  profile: ProfileType
  setProfile: (profile: ProfileType) => void
  patchProfile: (patchProps: Partial<ProfileType>) => void
}

export const useProfileStore = create<ProfileStore>((set) => ({
  profile: ProfileModel,
  setProfile: (profile) => {
    set({ profile })
  },
  patchProfile: (patchProps) => {
    set((state) => ({
      profile: { ...state.profile, ...patchProps }
    }))
  }
}))
