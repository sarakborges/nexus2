import { create } from 'zustand'

import {
  authenticateUser,
  clearAuthSession,
  createAuthSession,
  createUser,
  getCurrentAuthSession,
  getUserById,
  setUserCurrentProfile
} from '@/Services/Auth'
import { getProfiles } from '@/Services/Profile'
import { useProfileStore } from '@/Stores/Profile.store'
import type { AuthenticatedUser } from '@/Models/User.model'
import type {
  AuthSession,
  SignInCredentials,
  SignUpCredentials
} from '@/Types/Auth.type'

type AuthStore = {
  session: AuthSession | null
  signIn: (credentials: SignInCredentials) => Promise<AuthenticatedUser>
  signUp: (credentials: SignUpCredentials) => Promise<AuthenticatedUser>
  setCurrentProfile: (profileId: string) => boolean
  signOut: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  session: getCurrentAuthSession(),

  signIn: async (credentials) => {
    const authenticatedUser = await authenticateUser(credentials)

    getProfiles()

    const user = getUserById(authenticatedUser.id) ?? authenticatedUser
    const session = createAuthSession(user)

    useProfileStore.getState().loadProfiles(user)
    set({ session })

    return user
  },

  signUp: async (credentials) => {
    const user = await createUser(credentials)
    const session = createAuthSession(user)

    useProfileStore.getState().clearProfiles()
    set({ session })

    return user
  },

  setCurrentProfile: (profileId) => {
    const session = getCurrentAuthSession()

    if (!session) {
      return false
    }

    const user = setUserCurrentProfile(session.user.id, profileId)

    if (!user) {
      return false
    }

    useProfileStore.getState().loadProfiles(user)
    set({ session: getCurrentAuthSession() })

    return true
  },

  signOut: () => {
    clearAuthSession()
    useProfileStore.getState().clearProfiles()
    set({ session: null })
  }
}))
