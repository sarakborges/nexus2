import { queryClient } from '@/Services/Query/queryClient'
import { queryKeys } from '@/Services/Query/queryKeys'
import type {
  AuthSession,
  AuthenticatedUser,
  ProfileSettings,
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
  setCurrentProfileSettings: (settings: ProfileSettings) => void
  markActivitiesRead: (activityIds: readonly string[]) => void
  signOut: () => Promise<void>
}
export const useAuthStore = create<AuthStore>((set, get) => ({
  session: null,
  isInitialized: false,
  initializationError: false,
  setSession: (session, initializationError = false) => {
    const previousUserId = get().session?.user.id ?? null
    const nextUserId = session?.user.id ?? null
    if (previousUserId && previousUserId !== nextUserId) queryClient.clear()
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
          currentProfileSettings: null,
          suggestedCommunities: [],
          activities: [],
          activityCursor: null,
          hasMoreActivities: false,
          authenticatedAt: Date.now()
        }
    queryClient.clear()
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
          currentProfileSettings: null,
          suggestedCommunities: [],
          activities: [],
          activityCursor: null,
          hasMoreActivities: false,
          authenticatedAt: Date.now()
        }
    queryClient.clear()
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

      // Clear the previous profile snapshot immediately. Keeping it beside the
      // new user.currentProfile makes pages resolve different acting identities.
      set((state) => state.session ? {
        session: {
          ...state.session,
          user,
          currentProfile: null,
          currentProfileSettings: null,
          activities: [],
          activityCursor: null,
          hasMoreActivities: false
        }
      } : state)

      const updatedSession = get().session
      if (updatedSession) {
        queryClient.setQueryData(queryKeys.auth.session, updatedSession)
      }

      const hydratedSession = await getCurrentAuthSession().catch(() => null)
      if (
        hydratedSession?.user.id === user.id &&
        hydratedSession.user.currentProfile === profileId
      ) {
        set({ session: hydratedSession })
        queryClient.setQueryData(queryKeys.auth.session, hydratedSession)
      }
      return true
    } catch {
      return false
    }
  },
  markActivitiesRead: (activityIds) => {
    if (activityIds.length === 0) return
    const readIds = new Set(activityIds)
    set((state) => state.session ? {
      session: {
        ...state.session,
        activities: state.session.activities.map(activity =>
          readIds.has(activity.id) ? { ...activity, isRead: true } : activity
        )
      }
    } : state)
    const session = get().session
    if (session) queryClient.setQueryData(queryKeys.auth.session, session)
  },
  setCurrentProfileSettings: (settings) => {
    set((state) => state.session ? {
      session: { ...state.session, currentProfileSettings: settings }
    } : state)
    const session = get().session
    if (session) queryClient.setQueryData(queryKeys.auth.session, session)
  },
  signOut: async () => {
    await signOutUser()
    queryClient.clear()
    set({ session: null, isInitialized: true, initializationError: false })
    queryClient.removeQueries({ queryKey: queryKeys.auth.session })
  }
}))
