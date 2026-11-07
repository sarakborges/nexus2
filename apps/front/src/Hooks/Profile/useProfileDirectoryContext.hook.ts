import { useParams } from 'react-router'

import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'
import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { useProfileByUrl } from './useProfileByUrl.hook'
import type { UseProfileDirectoryContextResult } from './useProfileDirectoryContext.types'

export function useProfileDirectoryContext(): UseProfileDirectoryContextResult {
  const { url } = useParams<{ url: string }>()
  const normalized = normalizeEntityUrl(url)
  const profileQuery = useProfileByUrl({ url: normalized })
  const profile = profileQuery.data
  const typeCompatibility = useProfileTypeCompatibility(
    profile?.type ?? 'social'
  )
  const { page, pageSize, setPage } = useUrlPagination()

  return {
    normalized,
    profileQuery,
    profile,
    typeCompatibility,
    page,
    pageSize,
    setPage
  }
}
