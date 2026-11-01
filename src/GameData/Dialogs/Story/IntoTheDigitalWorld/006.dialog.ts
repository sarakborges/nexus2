import type { DialogType } from '@/Types/Dialog.type'

import { IntoTheDigitalWorld007 } from '@/GameData/Dialogs/Story/IntoTheDigitalWorld/007.dialog'
import { NpcGennai } from '@/GameData/Npcs/Gennai.npc'

import { getTexts } from '@/Helpers/Language'

import { useDialogStore } from '@/Stores/Dialog.store'

export const IntoTheDigitalWorld006 = {
  speaker: {
    id: NpcGennai.id,
    name: '???',
    portrait: NpcGennai.portrait
  },

  text: getTexts('ITDW_006'),

  actions: [
    {
      id: 'ITDW_006_CONTINUE',

      text: getTexts('SCENES_CONTINUE_BUTTON'),

      onClick: () => {
        const { setDialog } = useDialogStore.getState()
        setDialog(IntoTheDigitalWorld007)
      }
    }
  ]
} satisfies DialogType
