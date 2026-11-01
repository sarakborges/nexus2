import { useEffect } from 'react'

import { getTexts } from '@/Helpers/Language'
import { generateRandomAvatar } from '@/Helpers/Systems/Profile'

import { AVATAR_LAYERS } from '@/Consts/AvatarLayers.const'

import { useAvatarCustomizationStore } from '@/Stores/AvatarCustomization.store'
import { useProfileStore } from '@/Stores/Profile.store'

import { ShadowButton } from '@/Components/DesignSystem/ShadowButton'
import { Text } from '@/Components/DesignSystem/Text'
import { PlayerAvatar } from '@/Components/Global/PlayerAvatar'

import './AvatarCustomization.style.scss'

export const AvatarCustomization = () => {
  const { profile } = useProfileStore((state) => state)
  const { avatar, setAvatar, setLayer } = useAvatarCustomizationStore(
    (state) => state
  )

  useEffect(() => {
    if (!!avatar || !!profile.avatar) {
      return
    }

    setAvatar(generateRandomAvatar())
  }, [])

  const selectAvatarLayer = (layer: string) => {
    if (!avatar) {
      return
    }

    setLayer(layer)
  }

  return (
    <div className="avatar-customization">
      <main>
        <aside>
          <header>
            <Text>{getTexts('FASHION_CUSTOMIZATION_OPTIONS_TITLE')}</Text>
          </header>

          <main>
            {AVATAR_LAYERS.map((option) => (
              <ShadowButton
                key={`customize-avatar-options-${option}`}
                onClick={() => selectAvatarLayer(option)}
              >
                {getTexts(`AVATARCUSTOMIZATION_${option.toLocaleUpperCase()}`)}
              </ShadowButton>
            ))}
          </main>
        </aside>

        <main>
          <PlayerAvatar />
        </main>
      </main>
    </div>
  )
}
