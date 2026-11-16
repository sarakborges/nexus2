import type { UserPreferences } from '@nexus/common'

import type { UseUpdateSettingsResult } from './useUpdateSettings.types'
import { useSettingsStore } from '@/Stores/Settings.store'

export function useUpdateSettings(): UseUpdateSettingsResult {
  const applySettings = useSettingsStore((state) => state.updateSettings)
  const setUpdateError = useSettingsStore((state) => state.setUpdateError)

  const updateSettings = (patch: Partial<UserPreferences>) => {
    try {
      applySettings(patch)
      setUpdateError(false)
    } catch {
      setUpdateError(true)
    }
  }

  return {
    updateSettings,
    isUpdating: false
  }
}
