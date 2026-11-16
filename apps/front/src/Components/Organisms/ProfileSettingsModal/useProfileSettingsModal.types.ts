import type { ProfileSettings } from '@nexus/common'

export type ProfileActivityType = ProfileSettings['publishActivityTypes'][number]

export type ProfileSettingsDraft = {
  profileId: string
  value: ProfileSettings
}

export type SaveProfileSettingsVariables = {
  profileId: string
  settings: ProfileSettings
}

export type UseProfileSettingsModalResult = {
  hasProfile: boolean
  isLoading: boolean
  settings: ProfileSettings
  isSaving: boolean
  isDirty: boolean
  saveError: boolean
  saveSuccess: boolean
  setMessageAudience: (value: ProfileSettings['messageAudience']) => void
  toggleActivityType: (
    field: 'publishActivityTypes' | 'showFriendActivityTypes',
    type: ProfileActivityType
  ) => void
  save: () => void
  isDeleteConfirmationOpen: boolean
  isDeletingProfile: boolean
  requestDeleteProfile: () => void
  cancelDeleteProfile: () => void
  confirmDeleteProfile: () => void
}
