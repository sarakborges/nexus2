import type { UserPreferences } from '@nexus/common'

import type { SettingsType } from '@/Types/Settings.type'

export type UpdateContext = {
  previousSettings: SettingsType
  previousQuery: UserPreferences | undefined
}
