import type { DialogType } from '@/Types/Dialog.type'

import { IntoTheDigitalWorld003 } from '@/GameData/Dialogs/Story/IntoTheDigitalWorld/003.dialog'

import { getTexts } from '@/Helpers/Language'

import { useDialogStore } from '@/Stores/Dialog.store'

export const IntoTheDigitalWorld002 = {
  text: getTexts('ITDW_002'),

  actions: [
    {
      id: 'ITDW_002_CONTINUE',

      text: getTexts('SCENES_CONTINUE_BUTTON'),

      onClick: () => {
        const { setDialog } = useDialogStore.getState()
        setDialog(IntoTheDigitalWorld003)
      }
    }
  ]
} satisfies DialogType
