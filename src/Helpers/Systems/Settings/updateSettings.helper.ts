import { saveData } from '@/Helpers/Systems/Data'

import { useSettingsStore } from '@/Stores/Settings.store'

export const updateSettings = ({ language }: { language?: string }) => {
  const { settings, setSettings } = useSettingsStore.getState()

  if (!settings) {
    return
  }

  const updatedSettings = {
    ...settings,
    language: language ?? settings.language
  }

  setSettings(updatedSettings)

  saveData({
    key: 'settings',
    value: {
      language: language ?? settings.language
    }
  })
}
