import { getTexts } from '@/Helpers/Language'

import { useGameStore } from '@/Stores/Game.store'
import { useProfileStore } from '@/Stores/Profile.store'

import { Text } from '@/Components/DesignSystem/Text'
import { StartScreenOptions } from '@/Components/Main/StartScreenOptions'

import './StartScreen.style.scss'

export const StartScreen = () => {
  const { profile } = useProfileStore((state) => state)
  const { game } = useGameStore((state) => state)

  if (!!game?.hasGameStarted && !!profile) {
    return
  }

  return (
    <main className="start-screen">
      <main>
        <Text as="p">{getTexts('START_SCREEN_TITLE')}</Text>

        <StartScreenOptions />
      </main>
    </main>
  )
}
