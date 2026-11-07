import { useQuery } from '@tanstack/react-query'

import { useNavigate, useParams } from 'react-router'

import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { ROUTES } from '@/Constants/routes'
import { getProfileCommunities } from '@/Services/Community'
import { getProfileByUrl } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { getProfileFriends } from '@/Services/Relationship'
import { useAuthStore } from '@/Stores/Auth.store'
import type { UseProfilePageResult } from './useProfilePage.types'

export function useProfilePage(): UseProfilePageResult {
  const { url } = useParams<{ url: string }>()
  const navigate = useNavigate()
  const session = useAuthStore((state) => state.session)
  const requestedUrl = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const profileQuery = useQuery({
    queryKey: queryKeys.profiles.byUrl(requestedUrl),
    queryFn: () => getProfileByUrl(requestedUrl),
    enabled: Boolean(requestedUrl)
  })
  const profile = profileQuery.data
  const typeCompatibility = useProfileTypeCompatibility(
    profile?.type ?? 'social'
  )

  const friendsQuery = useQuery({
    queryKey: queryKeys.relationships.friends(profile?.id ?? '', 1, 16),
    queryFn: () => getProfileFriends(profile!.id, { page: 1, pageSize: 16 }),
    enabled: Boolean(profile?.id)
  })

  const communitiesQuery = useQuery({
    queryKey: queryKeys.communities.byProfile(profile?.id ?? '', 1, 16),
    queryFn: () =>
      getProfileCommunities(profile!.id, { page: 1, pageSize: 16 }),
    enabled: Boolean(profile?.id)
  })

  const friends = friendsQuery.data?.items ?? []
  const communities = communitiesQuery.data?.items ?? []
  const isOwner = session?.user.profiles.includes(profile?.id ?? '') ?? false
  const openEditProfile = () => {
    if (profile) navigate(ROUTES.profile + '/' + profile.url + '/edit')
  }

  return {
    requestedUrl,
    profileQuery,
    profile,
    typeCompatibility,
    canInteract: typeCompatibility.canInteract,
    friendsQuery,
    communitiesQuery,
    friends,
    communities,
    isOwner,
    openEditProfile
  }
}
