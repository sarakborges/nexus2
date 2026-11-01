import { useEffect } from 'react'

import { getTexts } from '@/Helpers/Language'
import { getSortedProfiles, loadProfiles } from '@/Helpers/Systems/Profile'
import { changeScene } from '@/Helpers/Systems/Scenes'

import { useProfileStore } from '@/Stores/Profile.store'
import { useSavedProfilesStore } from '@/Stores/SavedProfiles.store'

import { Button } from '@/Components/DesignSystem/Button'
import { Text } from '@/Components/DesignSystem/Text'
import { GameFile } from '@/Components/Global/GameFile'

import './StartScreenSavedGames.style.scss'

export const StartScreenSavedGames = () => {
  const { savedProfiles } = useSavedProfilesStore((state) => state)
  const { profile } = useProfileStore((state) => state)

  useEffect(() => {
    loadProfiles()
  }, [profile])

  const closeSavedGames = () => {
    changeScene('startScreen')
  }

  return (
    <div className="saved-games">
      {!!savedProfiles?.length && (
        <>
          <header>
            <Text as="h2">{getTexts('SAVED_GAMES')}</Text>
            <Button onClick={closeSavedGames}>
              {getTexts('SCENES_BACK_BUTTON')}
            </Button>
          </header>

          <main className="games-list">
            {getSortedProfiles(savedProfiles || []).map((profile) => (
              <GameFile profile={profile} key={`savedProfiles-${profile.id}`} />
            ))}
          </main>
        </>
      )}
    </div>
  )
}
