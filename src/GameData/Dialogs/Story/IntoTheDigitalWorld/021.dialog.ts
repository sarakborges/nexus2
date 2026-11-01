import type { DialogType } from '@/Types/Dialog.type'

import { IntoTheDigitalWorld022 } from '@/GameData/Dialogs/Story/IntoTheDigitalWorld/022.dialog'
import { DigiviceItem } from '@/GameData/Items/Digivice.item'

import { getTexts } from '@/Helpers/Language'

import { useDialogStore } from '@/Stores/Dialog.store'
import { useProfileStore } from '@/Stores/Profile.store'

export const IntoTheDigitalWorld021 = (): DialogType => {
  const { profile } = useProfileStore.getState()

  const choice =
    profile.meaningfulChoices?.['INTO_THE_DIGITAL_WORLD_NAME_REACTION']

  if (!choice) {
    throw new Error('Missing INTO_THE_DIGITAL_WORLD_NAME_REACTION choice')
  }

  return {
    text: getTexts(`ITDW_021_${choice.toUpperCase()}`),

    image: {
      src: DigiviceItem.picture,
      alt: DigiviceItem.name
    },

    actions: [
      {
        id: 'ITDW_021_CONTINUE',

        text: getTexts('SCENES_CONTINUE_BUTTON'),

        onClick: () => {
          const { setDialog } = useDialogStore.getState()
          setDialog(IntoTheDigitalWorld022)
        }
      }
    ]
  }
}
