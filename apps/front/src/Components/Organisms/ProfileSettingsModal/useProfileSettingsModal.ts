import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AuthSession, ProfileSettings } from '@nexus/common'

import { useAuthSessionState } from '@/Hooks/Auth'
import { useDeleteProfileMutation } from '@/Hooks/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { useToastStore } from '@/Stores/Toast.store'
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

export function useProfileSettingsModal(onClose: () => void): UseProfileSettingsModalResult {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { t } = useTranslations()
  const showToast = useToastStore(state => state.showToast)
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false)
  const deleteProfileMutation = useDeleteProfileMutation()
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
    },
    isDeleteConfirmationOpen,
    isDeletingProfile: deleteProfileMutation.isPending,
    requestDeleteProfile: () => {
      if (profileId && !deleteProfileMutation.isPending) setIsDeleteConfirmationOpen(true)
    },
    cancelDeleteProfile: () => {
      if (!deleteProfileMutation.isPending) setIsDeleteConfirmationOpen(false)
    },
    confirmDeleteProfile: () => {
      if (!profileId || deleteProfileMutation.isPending || saveMutation.isPending) return
      deleteProfileMutation.mutate(profileId, {
        onSuccess: session => {
          setIsDeleteConfirmationOpen(false)
          showToast(t('PROFILE_DELETE_SUCCESS'))
          onClose()
          navigate(session?.user.profiles.length ? ROUTES.home : ROUTES.gettingStarted, { replace: true })
        },
        onError: () => showToast(t('PROFILE_DELETE_ERROR'), 'error')
      })
    }
  }
}
