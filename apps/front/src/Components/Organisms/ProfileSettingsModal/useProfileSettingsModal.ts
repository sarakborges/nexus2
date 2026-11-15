import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { ProfileSettings } from '@nexus/common'

import { saveProfileSettings } from '@/Services/ProfileSettings'
import { useAuthStore } from '@/Stores/Auth.store'
import type {
  ProfileActivityType,
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

type Draft = {
  profileId: string
  value: ProfileSettings
}

type SaveVariables = {
  profileId: string
  settings: ProfileSettings
}

export function useProfileSettingsModal(): UseProfileSettingsModalResult {
  const session = useAuthStore(state => state.session)
  const setCurrentProfileSettings = useAuthStore(
    state => state.setCurrentProfileSettings
  )
  const profile = session?.currentProfile ?? null
  const profileId = profile?.id ?? null
  const persistedSettings = session?.currentProfileSettings ?? DEFAULT_SETTINGS
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saveSuccessProfileId, setSaveSuccessProfileId] = useState<string | null>(null)

  const settings = draft && draft.profileId === profileId
    ? draft.value
    : persistedSettings

  const saveMutation = useMutation({
    mutationFn: ({ profileId, settings }: SaveVariables) =>
      saveProfileSettings(profileId, settings),
    onMutate: () => setSaveSuccessProfileId(null),
    onSuccess: (saved, variables) => {
      const currentProfileId = useAuthStore.getState().session?.currentProfile?.id
      if (currentProfileId !== variables.profileId) return

      setCurrentProfileSettings(saved)
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
    profileId && JSON.stringify(settings) !== JSON.stringify(persistedSettings)
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
