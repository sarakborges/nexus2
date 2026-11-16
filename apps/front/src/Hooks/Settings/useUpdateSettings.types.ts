import type { UserPreferences } from '@nexus/common'

export type UseUpdateSettingsResult = {
  updateSettings: (patch: Partial<UserPreferences>) => void
  isUpdating: boolean
}
