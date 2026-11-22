import { useProfileDirectoryPage } from '@/Hooks/Profile'
import type { UseProfileCommunitiesPageResult } from './useProfileCommunitiesPage.types'

export function useProfileCommunitiesPage(): UseProfileCommunitiesPageResult {
  const directory = useProfileDirectoryPage('communities')
  const communities =
    directory.profileDirectoryQuery.data?.kind === 'communities'
      ? directory.profileDirectoryQuery.data.communities.items
      : []
  const totalItems =
    directory.profileDirectoryQuery.data?.kind === 'communities'
      ? directory.profileDirectoryQuery.data.communities.totalItems
      : 0

  return {
    ...directory,
    communities,
    totalItems
  }
}
