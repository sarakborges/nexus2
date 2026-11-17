import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'

import type { Profile } from '@nexus/common'
import { ROUTES } from '@/Constants/routes'
import { useDeleteProfileMutation } from '@/Hooks/Profile'
import { useSetCurrentProfileMutation, useAuthSessionState } from '@/Hooks/Auth'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { getOwnedProfiles } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useTranslations } from '@/Hooks/Language'
import { useToastStore } from '@/Stores/Toast.store'
import type { UseMyProfilesPageResult } from './useMyProfilesPage.types'

export function useMyProfilesPage(): UseMyProfilesPageResult {
  const navigate = useNavigate()
  const { t } = useTranslations()
  const showToast = useToastStore(state => state.showToast)
  const { session, isAuthInitialized } = useAuthSessionState(state => ({
    session: state.session,
    isAuthInitialized: state.isInitialized
  }))
  const userId = session?.user.id ?? null
  const currentProfileId = session?.currentProfile?.id ?? null
  const { page, pageSize, setPage } = useUrlPagination()
  const [profileToDelete, setProfileToDelete] = useState<Profile | null>(null)

  const profilesQuery = useQuery({
    queryKey: queryKeys.profiles.owned(userId ?? '', page, pageSize),
    queryFn: () => getOwnedProfiles({ page }),
    enabled: Boolean(userId && isAuthInitialized),
    staleTime: 30_000
  })
  const deleteProfileMutation = useDeleteProfileMutation()
  const selectProfileMutation = useSetCurrentProfileMutation()
  const profiles = profilesQuery.data?.items ?? []

  const selectProfile = (profileId: string) => {
    if (selectProfileMutation.isPending || deleteProfileMutation.isPending) return
    selectProfileMutation.mutate(profileId, {
      onSuccess: () => {
        showToast(t('TOAST_PROFILE_SWITCHED'))
        navigate(ROUTES.home, { replace: true })
      },
      onError: () => showToast(t('NAVIGATION_PROFILE_UPDATE_ERROR'), 'error')
    })
  }

  const requestDeleteProfile = (profile: Profile) => {
    if (!deleteProfileMutation.isPending && !selectProfileMutation.isPending) {
      setProfileToDelete(profile)
    }
  }

  const cancelDeleteProfile = () => {
    if (!deleteProfileMutation.isPending) setProfileToDelete(null)
  }

  const confirmDeleteProfile = () => {
    if (!profileToDelete || deleteProfileMutation.isPending) return
    deleteProfileMutation.mutate(profileToDelete.id, {
      onSuccess: () => {
        setProfileToDelete(null)
        showToast(t('PROFILE_DELETE_SUCCESS'))
        if (profiles.length === 1 && page > 1) setPage(page - 1)
      },
      onError: () => showToast(t('PROFILE_DELETE_ERROR'), 'error')
    })
  }

  return {
    isAuthInitialized,
    currentProfileId,
    profilesQuery,
    profiles,
    page,
    pageSize,
    setPage,
    isSelectingProfile: selectProfileMutation.isPending,
    isDeletingProfile: deleteProfileMutation.isPending,
    profileToDelete,
    selectProfile,
    requestDeleteProfile,
    cancelDeleteProfile,
    confirmDeleteProfile
  }
}
