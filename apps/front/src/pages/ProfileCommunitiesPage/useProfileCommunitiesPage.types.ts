import type { Community } from '@nexus/common'

import type { UseProfileDirectoryPageResult } from '@/Hooks/Profile'

export type UseProfileCommunitiesPageResult =
  UseProfileDirectoryPageResult & {
    communities: Community[]
    totalItems: number
  }
