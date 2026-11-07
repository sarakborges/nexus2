import type { UserPreferences } from '@nexus/common'
import type { UseMutationResult } from '@tanstack/react-query'

import type { SettingsType } from '@/Types/Settings.type'

export type UpdateContext = {
  previousSettings: SettingsType
  previousQuery: UserPreferences | undefined
}

export type UseUpdateSettingsResult = {
  updateSettings: (patch: Partial<UserPreferences>) => void
  mutation: UseMutationResult<
    UserPreferences,
    unknown,
    Partial<UserPreferences>,
    UpdateContext
  >
  isUpdating: boolean
}
