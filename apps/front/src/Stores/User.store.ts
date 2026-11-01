import { create } from 'zustand'

import type { AuthenticatedUser, User } from '@/Models/User.model'
import {
  authenticateUser,
  AuthError,
  createUser as createUserRecord,
  loadUsers,
  saveUsers,
  toAuthenticatedUser
} from '@/Services/Auth'
import type { SignInCredentials, SignUpCredentials } from '@/Types/Auth.type'

type UserStore = {
  users: User[]
  createUser: (credentials: SignUpCredentials) => Promise<AuthenticatedUser>
  authenticateUser: (
    credentials: SignInCredentials
  ) => Promise<AuthenticatedUser>
  getUserById: (userId: string) => AuthenticatedUser | null
  addProfileToUser: (
    userId: string,
    profileId: string,
    makeCurrent?: boolean
  ) => AuthenticatedUser | null
  setCurrentProfile: (
    userId: string,
    profileId: string
  ) => AuthenticatedUser | null
  reloadUsers: () => User[]
  replaceUsers: (users: User[]) => boolean
}

export const useUserStore = create<UserStore>((set, get) => ({
  users: loadUsers(),

  createUser: async (credentials) => {
    const previousUsers = get().users
    const user = await createUserRecord(credentials, previousUsers)
    const updatedUsers = [...previousUsers, user]

    if (!saveUsers(updatedUsers)) {
      throw new AuthError('STORAGE_UNAVAILABLE')
    }

    set({ users: updatedUsers })

    return toAuthenticatedUser(user)
  },

  authenticateUser: (credentials) =>
    authenticateUser(credentials, get().users),

  getUserById: (userId) => {
    const user = get().users.find((item) => item.id === userId)

    return user ? toAuthenticatedUser(user) : null
  },

  addProfileToUser: (userId, profileId, makeCurrent = false) => {
    const previousUsers = get().users
    const user = previousUsers.find((item) => item.id === userId)

    if (!user) {
      return null
    }

    const updatedUser: User = {
      ...user,
      profiles: user.profiles.includes(profileId)
        ? user.profiles
        : [...user.profiles, profileId],
      currentProfile: makeCurrent
        ? profileId
        : user.currentProfile ?? profileId
    }
    const updatedUsers = previousUsers.map((item) =>
      item.id === userId ? updatedUser : item
    )

    if (!saveUsers(updatedUsers)) {
      return null
    }

    set({ users: updatedUsers })

    return toAuthenticatedUser(updatedUser)
  },

  setCurrentProfile: (userId, profileId) => {
    const previousUsers = get().users
    const user = previousUsers.find((item) => item.id === userId)

    if (!user || !user.profiles.includes(profileId)) {
      return null
    }

    const updatedUser: User = {
      ...user,
      currentProfile: profileId
    }
    const updatedUsers = previousUsers.map((item) =>
      item.id === userId ? updatedUser : item
    )

    if (!saveUsers(updatedUsers)) {
      return null
    }

    set({ users: updatedUsers })

    return toAuthenticatedUser(updatedUser)
  },

  reloadUsers: () => {
    const users = loadUsers()

    set({ users })

    return users
  },

  replaceUsers: (users) => {
    if (!saveUsers(users)) {
      return false
    }

    set({ users })

    return true
  }
}))
