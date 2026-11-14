import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router'
import type { ProfileSettings } from '@nexus/common'

import { getProfileByUrl } from '@/Services/Profile/profile.service'
import { getProfileSettings, saveProfileSettings } from '@/Services/ProfileSettings'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import type { ProfileActivityType, UseProfileSettingsPageResult } from './useProfileSettingsPage.types'

const DEFAULT_SETTINGS: ProfileSettings = {
  messageAudience: 'everyone',
  publishActivityTypes: [
    'friend_connected',
    'profile_post',
    'community_created',
    'community_membership'
  ],
  showFriendActivityTypes: [
    'friend_connected',
    'profile_post',
    'community_created',
    'community_membership'
  ]
}

export function useProfileSettingsPage(profileUrl?: string): UseProfileSettingsPageResult {
  const routeParams = useParams()
  const url = profileUrl ?? routeParams.url ?? ''
  const session = useAuthStore(state => state.session)
  const userId = session?.user.id ?? null
  const currentProfile = session?.currentProfile?.url === url &&
    session.currentProfile.id === session.user.currentProfile
    ? session.currentProfile
    : null
  const currentProfileSettings = currentProfile
    ? session?.currentProfileSettings ?? DEFAULT_SETTINGS
    : null
  const queryClient = useQueryClient()
  const queryKey = queryKeys.profileSettings(url, userId ?? '')
  const [draft, setDraft] = useState<{ profileId: string; value: ProfileSettings } | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // The active profile and its settings already arrive together in /auth/me.
  // Only non-active owned profiles need the dedicated settings request.
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const profile = await getProfileByUrl(url)
      if (!profile) throw new Error('PROFILE_NOT_FOUND')
      return { profile, settings: await getProfileSettings(profile.id) }
    },
    enabled: Boolean(url && userId && !currentProfile),
    staleTime: 30_000
  })

  const profile = currentProfile ?? query.data?.profile
  const persistedSettings = currentProfile
    ? currentProfileSettings ?? DEFAULT_SETTINGS
    : query.data?.settings ?? DEFAULT_SETTINGS
  const settings = draft && profile && draft.profileId === profile.id
    ? draft.value
    : persistedSettings

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!profile) throw new Error('PROFILE_NOT_FOUND')
      return saveProfileSettings(profile.id, settings)
    },
    onMutate: () => setSaveSuccess(false),
    onSuccess: saved => {
      queryClient.setQueryData(queryKey, current =>
        current
          ? { ...current, settings: saved }
          : profile ? { profile, settings: saved } : current
      )
      if (currentProfile) {
        useAuthStore.getState().setCurrentProfileSettings(saved)
      }
      if (profile) setDraft({ profileId: profile.id, value: saved })
      setSaveSuccess(true)
    }
  })

  const updateDraft = (update: (current: ProfileSettings) => ProfileSettings) => {
    if (!profile) return
    setSaveSuccess(false)
    setDraft(current => ({
      profileId: profile.id,
      value: update(
        current && current.profileId === profile.id
          ? current.value
          : persistedSettings
      )
    }))
  }

  const toggleActivityType = (
    field: 'publishActivityTypes' | 'showFriendActivityTypes',
    type: ProfileActivityType
  ) => {
    updateDraft(base => ({
      ...base,
      [field]: base[field].includes(type)
        ? base[field].filter(item => item !== type)
        : [...base[field], type]
    }))
  }

  const isDirty = Boolean(
    profile && JSON.stringify(settings) !== JSON.stringify(persistedSettings)
  )

  return {
    isLoading: !currentProfile && query.isLoading,
    isError: !currentProfile && query.isError,
    profileName: profile?.name ?? '',
    settings,
    isSaving: saveMutation.isPending,
    isDirty,
    saveError: saveMutation.isError,
    saveSuccess,
    setMessageAudience: value => updateDraft(base => ({
      ...base,
      messageAudience: value
    })),
    toggleActivityType,
    save: () => saveMutation.mutate(),
    retry: () => {
      if (!currentProfile) void query.refetch()
    }
  }
}
