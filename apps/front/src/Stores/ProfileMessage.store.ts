import { create } from 'zustand'
import type { ProfileMessage } from '@/Models/ProfileMessage.model'
import { createProfileMessage, getProfileMessages } from '@/Services/ProfileMessage'

type ProfileMessageStore = {
  profileId: string | null
  viewerProfileId: string | null
  messages: ProfileMessage[]
  totalItems: number
  totalPages: number
  loadMessages: (profileId: string, viewerProfileId: string | null, page?: number, pageSize?: number) => Promise<void>
  sendMessage: (fromProfileId: string, toProfileId: string, content: string) => Promise<ProfileMessage>
  clearMessages: () => void
}
export const useProfileMessageStore = create<ProfileMessageStore>((set, get) => ({
  profileId: null,
  viewerProfileId: null,
  messages: [],
  totalItems: 0,
  totalPages: 1,
  loadMessages: async (profileId, viewerProfileId, page = 1, pageSize = 20) => {
    set({ profileId, viewerProfileId, messages: [], totalItems: 0, totalPages: 1 })
    const result = await getProfileMessages(profileId, { page, pageSize })
    if (get().profileId === profileId && get().viewerProfileId === viewerProfileId) {
      set({ messages: result.items, totalItems: result.totalItems, totalPages: result.totalPages })
    }
  },
  sendMessage: async (fromProfileId, toProfileId, content) => {
    const message = await createProfileMessage(fromProfileId, toProfileId, content)
    set((state) => state.profileId === toProfileId
      ? { messages: [message, ...state.messages], totalItems: state.totalItems + 1 }
      : state)
    return message
  },
  clearMessages: () => set({ profileId: null, viewerProfileId: null, messages: [], totalItems: 0, totalPages: 1 })
}))
