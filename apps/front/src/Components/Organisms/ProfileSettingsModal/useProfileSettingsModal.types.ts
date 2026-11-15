import type { ProfileSettings } from '@nexus/common'

export type ProfileActivityType = ProfileSettings['publishActivityTypes'][number]

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
}
