import { useProfileStore } from './Profile.store'
import { queryClient } from '@/Services/Query/queryClient'
import { queryKeys } from '@/Services/Query/queryKeys'
import type {
  AuthSession,
  AuthenticatedUser,
  SignInCredentials,
  SignUpCredentials
} from '@nexus/common'
import { create } from 'zustand'

import {
  getCurrentAuthSession,
  signInUser,
  signOutUser,
  signUpUser,
  setCurrentProfile as updateCurrentProfile
} from '@/Services/Auth'

type AuthStore = {
  session: AuthSession | null
  isInitialized: boolean
  initializationError: boolean
  setSession: (session: AuthSession | null, hasError?: boolean) => void
  initialize: () => Promise<void>
  signIn: (credentials: SignInCredentials) => Promise<AuthenticatedUser>
  signUp: (credentials: SignUpCredentials) => Promise<AuthenticatedUser>
  setCurrentProfile: (profileId: string) => Promise<boolean>
  signOut: () => Promise<void>
}
export const useAuthStore = create<AuthStore>((set, get) => ({
  session: null,
  isInitialized: false,
  initializationError: false,
  setSession: (session, initializationError = false) => {
    const previousUserId = get().session?.user.id ?? null
    const nextUserId = session?.user.id ?? null
    const currentProfileId = get().session?.user.currentProfile ?? null
    if (previousUserId && previousUserId !== nextUserId) queryClient.clear()
    if (currentProfileId !== (session?.user.currentProfile ?? null)) {
      useProfileStore.getState().clearProfile()
    }
    set({ session, isInitialized: true, initializationError })
    if (session) queryClient.setQueryData(queryKeys.auth.session, session)
    else queryClient.removeQueries({ queryKey: queryKeys.auth.session })
  },
  initialize: async () => {
    if (get().isInitialized) return
    try {
      const session = await getCurrentAuthSession()
      set({ session, isInitialized: true, initializationError: false })
      if (session) queryClient.setQueryData(queryKeys.auth.session, session)
      else queryClient.removeQueries({ queryKey: queryKeys.auth.session })
    } catch {
      set({ session: null, isInitialized: true, initializationError: true })
    }
  },
  signIn: async (credentials) => {
    const user = await signInUser(credentials)
    const hydratedSession = await getCurrentAuthSession().catch(() => null)
    const session = hydratedSession?.user.id === user.id
      ? hydratedSession
      : {
          user,
          currentProfile: null,
          activities: [],
          activityCursor: null,
          hasMoreActivities: false,
          authenticatedAt: Date.now()
        }
    queryClient.clear()
    useProfileStore.getState().clearProfile()
    set({
      session,
      isInitialized: true,
      initializationError: false
    })
    queryClient.setQueryData(queryKeys.auth.session, session)
    if (!hydratedSession) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.session })
    }
    return user
  },
  signUp: async (credentials) => {
    const user = await signUpUser(credentials)
    const hydratedSession = await getCurrentAuthSession().catch(() => null)
    const session = hydratedSession?.user.id === user.id
      ? hydratedSession
      : {
          user,
          currentProfile: null,
          activities: [],
          activityCursor: null,
          hasMoreActivities: false,
          authenticatedAt: Date.now()
        }
    queryClient.clear()
    useProfileStore.getState().clearProfile()
    set({
      session,
      isInitialized: true,
      initializationError: false
    })
    queryClient.setQueryData(queryKeys.auth.session, session)
    if (!hydratedSession) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.session })
    }
    return user
  },
  setCurrentProfile: async (profileId) => {
    if (!get().session) return false
    try {
      const user = await updateCurrentProfile(profileId)
      useProfileStore.getState().clearProfile()
      set((state) =>
        state.session ? { session: { ...state.session, user } } : state
      )
      return true
    } catch {
      return false
    }
  },
  signOut: async () => {
    await signOutUser()
    queryClient.clear()
    useProfileStore.getState().clearProfile()
    set({ session: null, isInitialized: true, initializationError: false })
    queryClient.removeQueries({ queryKey: queryKeys.auth.session })
  }
}))
