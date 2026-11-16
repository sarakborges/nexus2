import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AuthSession, ProfileSettings } from '@nexus/common'

import { useAuthSessionState } from '@/Hooks/Auth'
import { queryKeys } from '@/Services/Query/queryKeys'
import { saveProfileSettings } from '@/Services/ProfileSettings'
import { areProfileSettingsEquivalent } from './profileSettings.utils'
import type {
  ProfileActivityType,
  ProfileSettingsDraft,
  SaveProfileSettingsVariables,
  UseProfileSettingsModalResult
} from './useProfileSettingsModal.types'

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

export function useProfileSettingsModal(): UseProfileSettingsModalResult {
  const queryClient = useQueryClient()
  const session = useAuthSessionState(state => state.session)
  const profile = session?.currentProfile ?? null
  const profileId = profile?.id ?? null
  const persistedSettings = session?.currentProfileSettings ?? DEFAULT_SETTINGS
  const [draft, setDraft] = useState<ProfileSettingsDraft | null>(null)
  const [saveSuccessProfileId, setSaveSuccessProfileId] = useState<string | null>(null)

  const settings = draft && draft.profileId === profileId
    ? draft.value
    : persistedSettings

  const saveMutation = useMutation({
    mutationFn: ({ profileId, settings }: SaveProfileSettingsVariables) =>
      saveProfileSettings(profileId, settings),
    onMutate: () => setSaveSuccessProfileId(null),
    onSuccess: (saved, variables) => {
      const currentSession = queryClient.getQueryData<AuthSession | null>(
        queryKeys.auth.session
      )
      if (currentSession?.currentProfile?.id !== variables.profileId) return

      queryClient.setQueryData<AuthSession | null>(
        queryKeys.auth.session,
        () => ({ ...currentSession, currentProfileSettings: saved })
      )
      setDraft({ profileId: variables.profileId, value: saved })
      setSaveSuccessProfileId(variables.profileId)
    }
  })

  const updateDraft = (
    update: (current: ProfileSettings) => ProfileSettings
  ) => {
    if (!profileId) return
    setSaveSuccessProfileId(null)
    saveMutation.reset()
    setDraft(current => ({
      profileId,
      value: update(
        current && current.profileId === profileId
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
    profileId && !areProfileSettingsEquivalent(settings, persistedSettings)
  )
  const isCurrentProfileMutation = saveMutation.variables?.profileId === profileId

  return {
    hasProfile: Boolean(profileId),
    isLoading: Boolean(session?.user.currentProfile && !profile),
    settings,
    isSaving: saveMutation.isPending && isCurrentProfileMutation,
    isDirty,
    saveError: saveMutation.isError && isCurrentProfileMutation,
    saveSuccess: saveSuccessProfileId === profileId,
    setMessageAudience: value => updateDraft(base => ({
      ...base,
      messageAudience: value
    })),
    toggleActivityType,
    save: () => {
      if (!profileId || !isDirty || saveMutation.isPending) return
      saveMutation.mutate({ profileId, settings })
    }
  }
}
