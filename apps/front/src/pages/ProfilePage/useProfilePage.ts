import { useQuery } from '@tanstack/react-query'

import { useNavigate, useParams } from 'react-router'

import { getProfilePage } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'
import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { ROUTES } from '@/Constants/routes'
import { useAuthStore } from '@/Stores/Auth.store'
import type { UseProfilePageResult } from './useProfilePage.types'

export function useProfilePage(): UseProfilePageResult {
  const { url } = useParams<{ url: string }>()
  const navigate = useNavigate()
  const session = useAuthStore((state) => state.session)
  const isAuthInitialized = useAuthStore((state) => state.isInitialized)
  const viewerUserId = session?.user.id ?? null
  const currentProfileId = session?.user.currentProfile ?? null
  const requestedUrl = normalizeEntityUrl(url)

  const profilePageQuery = useQuery({
    queryKey: queryKeys.profilePage(requestedUrl, viewerUserId, currentProfileId),
    queryFn: () => getProfilePage(requestedUrl),
    enabled: Boolean(requestedUrl && isAuthInitialized),
    staleTime: 30 * 1000
  })
  const profile = profilePageQuery.data?.profile
  const viewerRelationship = profilePageQuery.data?.viewerRelationship ?? null
  const friends = profilePageQuery.data?.friends.items ?? []
  const communities = profilePageQuery.data?.communities.items ?? []
  const typeCompatibility = useProfileTypeCompatibility(
    profile?.type ?? 'social'
  )
  const isOwner = session?.user.profiles.includes(profile?.id ?? '') ?? false

  const openEditProfile = () => {
    if (profile) navigate(ROUTES.profile + '/' + profile.url + '/edit')
  }

  return {
    requestedUrl,
    profilePageQuery,
    profile,
    viewerRelationship,
    typeCompatibility,
    canInteract: typeCompatibility.canInteract,
    friends,
    communities,
    isOwner,
    openEditProfile
  }
}
