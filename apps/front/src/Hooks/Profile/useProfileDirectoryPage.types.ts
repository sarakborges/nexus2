import type {
  Profile,
  ProfileDirectoryPageData,
  Relationship
} from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

import type { UseUrlPaginationResult } from '@/Hooks/useUrlPagination.types'

export type UseProfileDirectoryPageResult = UseUrlPaginationResult & {
  normalized: string
  isAuthInitialized: boolean
  currentProfileId: string | null
  profileDirectoryQuery: UseQueryResult<ProfileDirectoryPageData>
  profile: Profile | null | undefined
  viewerRelationship: Relationship | null
  typeCompatibility: {
    isChecking: boolean
    isCompatible: boolean
    canInteract: boolean
  }
}
