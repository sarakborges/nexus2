import { create } from 'zustand'

import type { AvatarType } from '@/Types/Avatar.type'

type AvatarCustomizationStore = {
  avatar: AvatarType | null
  layer?: string
  setAvatar: (avatarCustomization: AvatarType) => void
  setLayer: (layer: string) => void
}

export const useAvatarCustomizationStore = create<AvatarCustomizationStore>(
  (set) => ({
    avatar: null,
    layer: undefined,
    setAvatar: (avatar) => {
      set({ avatar })
    },
    setLayer: (layer) => {
      set({ layer })
    }
  })
)
