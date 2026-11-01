import { create } from 'zustand'

import {
  authenticate,
  clearAuthSession,
  createAccount,
  createAuthSession,
  getCurrentAuthSession
} from '@/Services/Auth'
import type {
  AuthSession,
  AuthUser,
  SignInCredentials,
  SignUpCredentials
} from '@/Types/Auth.type'

type AuthStore = {
  session: AuthSession | null
  signIn: (credentials: SignInCredentials) => Promise<AuthUser>
  signUp: (credentials: SignUpCredentials) => Promise<AuthUser>
  signOut: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  session: getCurrentAuthSession(),

  signIn: async (credentials) => {
    const user = await authenticate(credentials)
    const session = createAuthSession(user)

    set({ session })

    return user
  },

  signUp: async (credentials) => {
    const user = await createAccount(credentials)
    const session = createAuthSession(user)

    set({ session })

    return user
  },

  signOut: () => {
    clearAuthSession()
    set({ session: null })
  }
}))
