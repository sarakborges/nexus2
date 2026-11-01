import type { DialogType } from '@/Types/Dialog.type'

import { IntoTheDigitalWorld004 } from '@/GameData/Dialogs/Story/IntoTheDigitalWorld/004.dialog'
import { NpcGennai } from '@/GameData/Npcs/Gennai.npc'

import { getTexts } from '@/Helpers/Language'

import { useDialogStore } from '@/Stores/Dialog.store'

export const IntoTheDigitalWorld003 = {
  speaker: {
    id: NpcGennai.id,
    name: '???'
  },

  image: {
    src: NpcGennai.picture,
    alt: NpcGennai.name
  },

  text: getTexts('ITDW_003'),

  actions: [
    {
      id: 'ITDW_003_CONTINUE',

      text: getTexts('SCENES_CONTINUE_BUTTON'),

      onClick: () => {
        const { setDialog } = useDialogStore.getState()
        setDialog(IntoTheDigitalWorld004)
      }
    }
  ]
} satisfies DialogType
