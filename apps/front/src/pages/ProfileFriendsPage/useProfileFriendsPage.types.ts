import type { PaginatedResult, Profile } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'
import type { UseProfileDirectoryContextResult } from '@/Hooks/Profile'

export type UseProfileFriendsPageResult = UseProfileDirectoryContextResult & {
  canInteract: boolean
  friendsQuery: UseQueryResult<PaginatedResult<Profile>>
  friends: Profile[]
  totalItems: number
}
