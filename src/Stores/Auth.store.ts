import { create } from 'zustand'

import {
  authenticateUser,
  clearAuthSession,
  createAuthSession,
  createUser,
  getCurrentAuthSession
} from '@/Services/Auth'
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
    const user = await authenticateUser(credentials)
    const session = createAuthSession(user)

    useProfileStore.getState().loadProfile(user.id)
    set({ session })

    return user
  },

  signUp: async (credentials) => {
    const user = await createUser(credentials)
    const session = createAuthSession(user)

    useProfileStore.getState().clearProfile()
    set({ session })

    return user
  },

  signOut: () => {
    clearAuthSession()
    useProfileStore.getState().clearProfile()
    set({ session: null })
  }
}))
