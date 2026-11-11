import { useMemo } from 'react'

import { useProfileDirectoryPage } from '@/Hooks/Profile'
import type { UseProfileFriendsPageResult } from './useProfileFriendsPage.types'

export function useProfileFriendsPage(): UseProfileFriendsPageResult {
  const directory = useProfileDirectoryPage('friends')
  const friends =
    directory.profileDirectoryQuery.data?.kind === 'friends'
      ? directory.profileDirectoryQuery.data.friends.items
      : []
  const totalItems =
    directory.profileDirectoryQuery.data?.kind === 'friends'
      ? directory.profileDirectoryQuery.data.friends.totalItems
      : 0
  const friendRelationshipsByProfileId = useMemo(() => {
    const relationships =
      directory.profileDirectoryQuery.data?.kind === 'friends'
        ? directory.profileDirectoryQuery.data.friendRelationships
        : []

    return new Map(
      relationships.map((relationship) => {
        const friendId =
          relationship.profiles.find(
            (id) => id !== directory.currentProfileId
          ) ?? ''
        return [friendId, relationship] as const
      })
    )
  }, [directory.profileDirectoryQuery.data, directory.currentProfileId])

  return {
    ...directory,
    canInteract: directory.typeCompatibility.canInteract,
    friendRelationshipsByProfileId,
    friends,
    totalItems
  }
}
