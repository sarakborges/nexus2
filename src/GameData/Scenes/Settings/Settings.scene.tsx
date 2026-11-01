import { getTexts } from '@/Helpers/Language'
import { changeScene } from '@/Helpers/Systems/Scenes'

import { useProfileStore } from '@/Stores/Profile.store'

import { ShadowButton } from '@/Components/DesignSystem/ShadowButton'
import { Text } from '@/Components/DesignSystem/Text'
import { SettingsLanguage } from '@/Components/Settings/Languages'

import './Settings.style.scss'

export const Settings = () => {
  const { profile } = useProfileStore((state) => state)

  const closeSettings = () => {
    if (!profile.lastScene) {
      throw new Error('Last scene not found')
    }

    changeScene(profile.lastScene)
  }

  return (
    <div className="settings">
      <header className="settings-header">
        <Text>{getTexts('SETTINGS_TITLE')}</Text>
      </header>

      <main>
        <SettingsLanguage />
      </main>

      <footer>
        <ShadowButton onClick={closeSettings}>
          {getTexts('SETTINGS_LEAVE')}
        </ShadowButton>
      </footer>
    </div>
  )
}
