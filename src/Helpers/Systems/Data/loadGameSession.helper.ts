import { ProfileModel } from '@/Models/Profile.model'

import { loadData, loadSession } from '@/Helpers/Systems/Data'

import { useDialogStore } from '@/Stores/Dialog.store'
import { useGameStore } from '@/Stores/Game.store'
import { useProfileStore } from '@/Stores/Profile.store'
import { useSettingsStore } from '@/Stores/Settings.store'

export const loadGameSession = () => {
  const { setGame } = useGameStore.getState()
  const { setDialog } = useDialogStore.getState()
  const { setProfile } = useProfileStore.getState()
  const { setSettings } = useSettingsStore.getState()

  try {
    const profile = loadSession(`profile`)

    setProfile(
      !!profile ? profile : { ...ProfileModel, currentScene: 'startScreen' }
    )

    setDialog(null)

    setGame({
      hasGameStarted: !!profile
    })

    setSettings(loadData('settings'))
  } catch (error) {
    console.warn(`Error loading game session: ${error}`)
  }
}
