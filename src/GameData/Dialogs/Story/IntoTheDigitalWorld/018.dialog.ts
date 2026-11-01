import type { DialogType } from '@/Types/Dialog.type'

import { IntoTheDigitalWorld019 } from '@/GameData/Dialogs/Story/IntoTheDigitalWorld/019.dialog'

import { getTexts } from '@/Helpers/Language'

import { useDialogStore } from '@/Stores/Dialog.store'

export const IntoTheDigitalWorld018 = {
  text: getTexts('ITDW_018'),

  actions: [
    {
      id: 'ITDW_018_CONTINUE',

      text: getTexts('SCENES_CONTINUE_BUTTON'),

      onClick: () => {
        const { setDialog } = useDialogStore.getState()
        setDialog(IntoTheDigitalWorld019())
      }
    }
  ]
} satisfies DialogType
