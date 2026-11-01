import type { DialogType } from '@/Types/Dialog.type'

import { getIntoTheDigitalWorld024 } from '@/GameData/Dialogs/Story/IntoTheDigitalWorld/024.dialog'

import { getTexts } from '@/Helpers/Language'

import { useDialogStore } from '@/Stores/Dialog.store'
import { useProfileStore } from '@/Stores/Profile.store'

export const IntoTheDigitalWorld023 = (): DialogType => {
  const { profile } = useProfileStore.getState()

  return {
    speaker: {
      id: 'player',
      name: profile.name
    },

    text: getTexts('ITDW_023'),

    actions: [
      {
        id: 'ITDW_023_CONTINUE',

        text: getTexts('SCENES_CONTINUE_BUTTON'),

        onClick: () => {
          const { setDialog } = useDialogStore.getState()
          setDialog(getIntoTheDigitalWorld024())
        }
      }
    ]
  }
}
