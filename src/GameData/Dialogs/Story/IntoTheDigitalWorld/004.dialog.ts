import type { DialogType } from '@/Types/Dialog.type'

import { IntoTheDigitalWorld005 } from '@/GameData/Dialogs/Story/IntoTheDigitalWorld/005.dialog'
import { NpcGennai } from '@/GameData/Npcs/Gennai.npc'

import { getTexts } from '@/Helpers/Language'

import { useDialogStore } from '@/Stores/Dialog.store'

export const IntoTheDigitalWorld004 = {
  speaker: {
    id: NpcGennai.id,
    name: '???',
    portrait: NpcGennai.portrait
  },

  text: getTexts('ITDW_004'),

  actions: [
    {
      id: 'ITDW_004_CONTINUE',

      text: getTexts('SCENES_CONTINUE_BUTTON'),

      onClick: () => {
        const { setDialog } = useDialogStore.getState()
        setDialog(IntoTheDigitalWorld005)
      }
    }
  ]
} satisfies DialogType
