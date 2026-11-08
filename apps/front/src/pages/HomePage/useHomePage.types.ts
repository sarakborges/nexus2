import type { Profile } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'
import type { UseHomeActivityResult } from './useHomeActivity.types'
import type { UseHomeCommunitySuggestionsResult } from './useHomeCommunitySuggestions.types'
import type { UseHomeSocialPreviewsResult } from './useHomeSocialPreviews.types'

export type UseHomePageResult = {
  profilesQuery: UseQueryResult<Profile[]>
  currentProfile: Profile | null
} & UseHomeActivityResult &
  UseHomeSocialPreviewsResult &
  UseHomeCommunitySuggestionsResult
