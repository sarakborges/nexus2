import type { DialogType } from '@/Types/Dialog.type'

import { IntoTheDigitalWorld020 } from '@/GameData/Dialogs/Story/IntoTheDigitalWorld/020.dialog'

import { getTexts } from '@/Helpers/Language'

import { useDialogStore } from '@/Stores/Dialog.store'
import { useProfileStore } from '@/Stores/Profile.store'

export const IntoTheDigitalWorld019 = (): DialogType => {
  const { profile } = useProfileStore.getState()

  const choice =
    profile.meaningfulChoices?.['INTO_THE_DIGITAL_WORLD_NAME_REACTION']

  if (!choice) {
    throw new Error('Missing INTO_THE_DIGITAL_WORLD_NAME_REACTION choice')
  }

  return {
    speaker: {
      id: 'player',
      name: profile.name
    },

    text: getTexts(`ITDW_019_${choice.toUpperCase()}`),

    actions: [
      {
        id: 'ITDW_019_CONTINUE',

        text: getTexts('SCENES_CONTINUE_BUTTON'),

        onClick: () => {
          const { setDialog } = useDialogStore.getState()
          setDialog(IntoTheDigitalWorld020())
        }
      }
    ]
  }
}
