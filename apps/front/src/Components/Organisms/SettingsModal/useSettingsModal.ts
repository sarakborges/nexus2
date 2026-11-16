import type { UseSettingsModalController } from './useSettingsModal.types'
import { useSettingsStore } from '@/Stores/Settings.store'

export function useSettingsModal(): UseSettingsModalController {
  const updateError = useSettingsStore((state) => state.updateError)

  return { updateError }
}
