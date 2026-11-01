import { create } from 'zustand'
import type { AuthenticatedUser, User } from '@/Models/User.model'

type UserStore = {
  users: User[]
  getUserById: (userId: string) => AuthenticatedUser | null
  reloadUsers: () => User[]
  replaceUsers: (users: User[]) => boolean
}
export const useUserStore = create<UserStore>(() => ({
  users: [],
  getUserById: () => null,
  reloadUsers: () => [],
  replaceUsers: () => false
}))
