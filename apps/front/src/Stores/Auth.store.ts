import { create } from 'zustand'
import type { AuthenticatedUser, AuthSession, SignInCredentials, SignUpCredentials } from '@nexus/common'
import { getCurrentAuthSession, setCurrentProfile as updateCurrentProfile, signInUser, signOutUser, signUpUser } from '@/Services/Auth'
import { useProfileStore } from './Profile.store'

type AuthStore = {
  session: AuthSession | null
  isInitialized: boolean
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
  initialize: async () => {
    if (get().isInitialized) return
    const session = await getCurrentAuthSession()
    set({ session, isInitialized: true })
  },
  signIn: async (credentials) => {
    const user = await signInUser(credentials)
    useProfileStore.getState().clearProfile()
    set({ session: { user, authenticatedAt: Date.now() }, isInitialized: true })
    return user
  },
  signUp: async (credentials) => {
    const user = await signUpUser(credentials)
    useProfileStore.getState().clearProfile()
    set({ session: { user, authenticatedAt: Date.now() }, isInitialized: true })
    return user
  },
  addProfileToUser: (profileId, makeCurrent = false) => {
    const session = get().session
    if (!session || session.user.profiles.includes(profileId)) return false
    const user = { ...session.user, profiles: [...session.user.profiles, profileId], currentProfile: makeCurrent ? profileId : session.user.currentProfile ?? profileId }
    set({ session: { ...session, user } })
    return true
  },
  setCurrentProfile: async (profileId) => {
    if (!get().session) return false
    try {
      const user = await updateCurrentProfile(profileId)
      set((state) => state.session ? { session: { ...state.session, user } } : state)
      return true
    } catch { return false }
  },
  signOut: async () => {
    await signOutUser()
    useProfileStore.getState().clearProfile()
    set({ session: null, isInitialized: true })
  }
}))
