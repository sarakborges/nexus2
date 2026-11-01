import { create } from 'zustand'

import type { AuthenticatedUser } from '@/Models/User.model'
import {
  clearAuthSession,
  createAuthSession,
  getCurrentAuthSession,
  saveAuthSession
} from '@/Services/Auth'
import { useProfileStore } from '@/Stores/Profile.store'
import { useUserStore } from '@/Stores/User.store'
import type {
  AuthSession,
  SignInCredentials,
  SignUpCredentials
} from '@/Types/Auth.type'

type AuthStore = {
  session: AuthSession | null
  signIn: (credentials: SignInCredentials) => Promise<AuthenticatedUser>
  signUp: (credentials: SignUpCredentials) => Promise<AuthenticatedUser>
  addProfileToUser: (profileId: string, makeCurrent?: boolean) => boolean
  setCurrentProfile: (profileId: string) => boolean
  signOut: () => void
}

const initialUsers = useUserStore.getState().users

export const useAuthStore = create<AuthStore>((set, get) => ({
  session: getCurrentAuthSession(initialUsers),

  signIn: async (credentials) => {
    const user = await useUserStore.getState().authenticateUser(credentials)
    const session = createAuthSession(user)

    useProfileStore.getState().clearProfile()
    set({ session })

    return user
  },

  signUp: async (credentials) => {
    const userStore = useUserStore.getState()
    const previousUsers = userStore.users
    const user = await userStore.createUser(credentials)

    try {
      const session = createAuthSession(user)

      useProfileStore.getState().clearProfile()
      set({ session })

      return user
    } catch (error) {
      useUserStore.getState().replaceUsers(previousUsers)
      throw error
    }
  },

  addProfileToUser: (profileId, makeCurrent = false) => {
    const session = get().session

    if (!session) {
      return false
    }

    const userStore = useUserStore.getState()
    const previousUsers = userStore.users
    const user = userStore.addProfileToUser(
      session.user.id,
      profileId,
      makeCurrent
    )

    if (!user) {
      return false
    }

    const updatedSession: AuthSession = {
      ...session,
      user
    }

    if (!saveAuthSession(updatedSession)) {
      userStore.replaceUsers(previousUsers)
      return false
    }

    set({ session: updatedSession })

    return true
  },

  setCurrentProfile: (profileId) => {
    const session = get().session

    if (!session) {
      return false
    }

    const userStore = useUserStore.getState()
    const previousUsers = userStore.users
    const user = userStore.setCurrentProfile(session.user.id, profileId)

    if (!user) {
      return false
    }

    const updatedSession: AuthSession = {
      ...session,
      user
    }

    if (!saveAuthSession(updatedSession)) {
      userStore.replaceUsers(previousUsers)
      return false
    }

    set({ session: updatedSession })

    return true
  },

  signOut: () => {
    clearAuthSession()
    useProfileStore.getState().clearProfile()
    set({ session: null })
  }
}))
