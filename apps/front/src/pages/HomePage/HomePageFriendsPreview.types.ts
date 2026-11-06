import type { PaginatedResult, Profile } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type HomePageFriendsPreviewProps = {
  profileUrl: string
  friendsQuery: UseQueryResult<PaginatedResult<Profile>>
  friends: Profile[]
}
