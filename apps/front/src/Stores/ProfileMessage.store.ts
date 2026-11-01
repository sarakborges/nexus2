import { create } from 'zustand'

import type { ProfileMessage } from '@/Models/ProfileMessage.model'
import {
  createProfileMessage,
  getAllProfileMessages,
  getProfileMessages,
  ProfileMessageError,
  saveProfileMessages
} from '@/Services/ProfileMessage'

type ProfileMessageStore = {
  profileId: string | null
  viewerProfileId: string | null
  messages: ProfileMessage[]
  loadMessages: (
    profileId: string,
    viewerProfileId: string | null
  ) => void
  sendMessage: (
    fromProfileId: string,
    toProfileId: string,
    content: string
  ) => ProfileMessage
  clearMessages: () => void
}

export const useProfileMessageStore = create<ProfileMessageStore>((set) => ({
  profileId: null,
  viewerProfileId: null,
  messages: [],

  loadMessages: (profileId, viewerProfileId) => {
    set({
      profileId,
      viewerProfileId,
      messages: getProfileMessages(profileId, viewerProfileId)
    })
  },

  sendMessage: (fromProfileId, toProfileId, content) => {
    const existingMessages = getAllProfileMessages()
    const message = createProfileMessage(
      fromProfileId,
      toProfileId,
      content
    )
    const updatedMessages = [...existingMessages, message]

    if (!saveProfileMessages(updatedMessages)) {
      throw new ProfileMessageError('STORAGE_UNAVAILABLE')
    }

    set({
      profileId: toProfileId,
      viewerProfileId: fromProfileId,
      messages: getProfileMessages(toProfileId, fromProfileId)
    })

    return message
  },

  clearMessages: () => {
    set({ profileId: null, viewerProfileId: null, messages: [] })
  }
}))
