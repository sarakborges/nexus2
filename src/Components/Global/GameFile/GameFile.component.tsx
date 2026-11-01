import type { ProfileType } from '@/Types/Profile.type'

import { getTexts } from '@/Helpers/Language'

import { Text } from '@/Components/DesignSystem/Text'
import { LoadGame } from '@/Components/Global/LoadGame'
import { PlayerAvatar } from '@/Components/Global/PlayerAvatar'

import './GameFile.style.scss'

export const GameFile = ({ profile }: { profile: ProfileType }) => {
  if (!profile.id) {
    throw new Error('Profile ID not found')
  }

  return (
    <div className="game-file">
      <PlayerAvatar />

      <header>
        <Text as="p">
          {getTexts('GAME_FILE_TITLE', {
            '[NAME]': profile.name,
            '[ID]': String(profile.id)
          })}
        </Text>

        <Text as="p">
          {getTexts('GAME_FILE_TIME', {
            '[TIME]': new Date(profile.lastSave).toLocaleString()
          })}
        </Text>
      </header>

      <div className="game-options">
        <LoadGame profileId={profile.id} />
      </div>
    </div>
  )
}
