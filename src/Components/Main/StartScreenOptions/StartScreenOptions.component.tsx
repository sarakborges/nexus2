import { getTexts } from '@/Helpers/Language'
import { createNewProfile } from '@/Helpers/Systems/Profile'
import { changeScene } from '@/Helpers/Systems/Scenes'

import { ShadowButton } from '@/Components/DesignSystem/ShadowButton'
import { Text } from '@/Components/DesignSystem/Text'

import './StartScreenOptions.style.scss'

export const StartScreenOptions = () => {
  const buttons = [
    {
      text: getTexts('START_NEW_GAME'),
      onClick: createNewProfile
    },

    {
      text: getTexts('DISPLAY_SAVED_GAMES'),
      onClick: () => changeScene('savedGames')
    },

    {
      text: getTexts('SETTINGS_TITLE'),
      onClick: () => changeScene('settings')
    }
  ]

  return (
    <div className="start-screen-options">
      {buttons.map((button) => (
        <ShadowButton
          key={`start-screen-button-${button.text}`}
          onClick={button.onClick}
        >
          <Text>{button.text}</Text>
        </ShadowButton>
      ))}
    </div>
  )
}
