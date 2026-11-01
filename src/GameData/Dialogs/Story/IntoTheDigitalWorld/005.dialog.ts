import type { DialogType } from '@/Types/Dialog.type'

import { IntoTheDigitalWorld006 } from '@/GameData/Dialogs/Story/IntoTheDigitalWorld/006.dialog'
import { NpcGennai } from '@/GameData/Npcs/Gennai.npc'

import { getTexts } from '@/Helpers/Language'

import { useDialogStore } from '@/Stores/Dialog.store'

export const IntoTheDigitalWorld005 = {
  speaker: {
    id: NpcGennai.id,
    name: '???',
    portrait: NpcGennai.portrait
  },

  text: getTexts('ITDW_005'),

  actions: [
    {
      id: 'ITDW_005_CONTINUE',

      text: getTexts('SCENES_CONTINUE_BUTTON'),

      onClick: () => {
        const { setDialog } = useDialogStore.getState()
        setDialog(IntoTheDigitalWorld006)
      }
    }
  ]
} satisfies DialogType
