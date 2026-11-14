import type { ProfileSettings } from '@nexus/common'

export type ProfileActivityType = ProfileSettings['publishActivityTypes'][number]
export type ProfileActivityPreferenceField = 'publishActivityTypes' | 'showFriendActivityTypes'

export type ProfileSettingsActivityMatrixProps = {
  settings: ProfileSettings
  onToggle: (field: ProfileActivityPreferenceField, type: ProfileActivityType) => void
}
