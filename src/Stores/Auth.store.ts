import { create } from 'zustand'

import {
  authenticateUser,
  clearAuthSession,
  createAuthSession,
  createUser,
  getCurrentAuthSession,
  getUserById
} from '@/Services/Auth'
import { getProfiles } from '@/Services/Profile'
import { useProfileStore } from '@/Stores/Profile.store'
import type {
  AuthSession,
  SignInCredentials,
  SignUpCredentials
} from '@/Types/Auth.type'
import type { AuthenticatedUser } from '@/Models/User.model'

type AuthStore = {
  session: AuthSession | null
  signIn: (credentials: SignInCredentials) => Promise<AuthenticatedUser>
  signUp: (credentials: SignUpCredentials) => Promise<AuthenticatedUser>
  signOut: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  session: getCurrentAuthSession(),

  signIn: async (credentials) => {
    const authenticatedUser = await authenticateUser(credentials)

    // Migrate legacy tab-scoped profiles before resolving the user's profile IDs.
    getProfiles()

    const user = getUserById(authenticatedUser.id) ?? authenticatedUser
    const session = createAuthSession(user)

    useProfileStore.getState().loadProfiles(user.profiles)
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

  signOut: () => {
    clearAuthSession()
    useProfileStore.getState().clearProfiles()
    set({ session: null })
  }
}))
