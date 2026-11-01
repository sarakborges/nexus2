import type { DialogType } from '@/Types/Dialog.type'

import { IntoTheDigitalWorld016 } from '@/GameData/Dialogs/Story/IntoTheDigitalWorld/016.dialog'

import { getTexts } from '@/Helpers/Language'

import { useDialogStore } from '@/Stores/Dialog.store'
import { useProfileStore } from '@/Stores/Profile.store'

export const getIntoTheDigitalWorld015 = (): DialogType => {
  const { profile } = useProfileStore.getState()

  return {
    speaker: {
      id: 'player',
      name: profile.name
    },

    text: getTexts('ITDW_015'),

    actions: [
      {
        id: 'ITDW_015_CONTINUE',

        text: getTexts('SCENES_CONTINUE_BUTTON'),

        onClick: () => {
          const { setDialog } = useDialogStore.getState()
          setDialog(IntoTheDigitalWorld016)
        }
      }
    ]
  }
}
