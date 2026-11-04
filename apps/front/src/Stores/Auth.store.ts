import { create } from 'zustand'
import type { AuthenticatedUser, AuthSession, SignInCredentials, SignUpCredentials } from '@nexus/common'
import { getCurrentAuthSession, setCurrentProfile as updateCurrentProfile, signInUser, signOutUser, signUpUser } from '@/Services/Auth'
import { useProfileStore } from './Profile.store'

type AuthStore = {
  session: AuthSession | null
  isInitialized: boolean
  initializationError: boolean
  setSession: (session: AuthSession | null, hasError?: boolean) => void
  initialize: () => Promise<void>
  signIn: (credentials: SignInCredentials) => Promise<AuthenticatedUser>
  signUp: (credentials: SignUpCredentials) => Promise<AuthenticatedUser>
  addProfileToUser: (profileId: string, makeCurrent?: boolean) => boolean
  setCurrentProfile: (profileId: string) => Promise<boolean>
  signOut: () => Promise<void>
}
export const useAuthStore = create<AuthStore>((set, get) => ({
  session: null,
  isInitialized: false,
  initializationError: false,
  setSession: (session, initializationError = false) => {
    const currentProfileId = get().session?.user.currentProfile ?? null
    if (currentProfileId !== (session?.user.currentProfile ?? null)) {
      useProfileStore.getState().clearProfile()
    }
    set({ session, isInitialized: true, initializationError })
  },
  initialize: async () => {
    if (get().isInitialized) return
    try {
      const session = await getCurrentAuthSession()
      set({ session, isInitialized: true, initializationError: false })
    } catch {
      set({ session: null, isInitialized: true, initializationError: true })
    }
  },
  signIn: async (credentials) => {
    const user = await signInUser(credentials)
    useProfileStore.getState().clearProfile()
    set({ session: { user, authenticatedAt: Date.now() }, isInitialized: true, initializationError: false })
    return user
  },
  signUp: async (credentials) => {
    const user = await signUpUser(credentials)
    useProfileStore.getState().clearProfile()
    set({ session: { user, authenticatedAt: Date.now() }, isInitialized: true, initializationError: false })
    return user
  },
  addProfileToUser: (profileId, makeCurrent = false) => {
    const session = get().session
    if (!session) return false
    const profiles = session.user.profiles.includes(profileId)
      ? session.user.profiles
      : [...session.user.profiles, profileId]
    const user = {
      ...session.user,
      profiles,
      currentProfile: makeCurrent ? profileId : session.user.currentProfile ?? profileId
    }
    if (makeCurrent && session.user.currentProfile !== profileId) {
      useProfileStore.getState().clearProfile()
    }
    set({ session: { ...session, user } })
    return true
  },
  setCurrentProfile: async (profileId) => {
    if (!get().session) return false
    try {
      const user = await updateCurrentProfile(profileId)
      useProfileStore.getState().clearProfile()
      set((state) => state.session ? { session: { ...state.session, user } } : state)
      return true
    } catch { return false }
  },
  signOut: async () => {
    await signOutUser()
    useProfileStore.getState().clearProfile()
    set({ session: null, isInitialized: true, initializationError: false })
  }
}))
