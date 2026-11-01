import type { DialogType } from '@/Types/Dialog.type'

import { IntoTheDigitalWorld008 } from '@/GameData/Dialogs/Story/IntoTheDigitalWorld/008.dialog'
import { NpcGennai } from '@/GameData/Npcs/Gennai.npc'

import { getTexts } from '@/Helpers/Language'

import { useDialogStore } from '@/Stores/Dialog.store'

export const IntoTheDigitalWorld007 = {
  speaker: {
    id: NpcGennai.id,
    name: NpcGennai.name,
    title: getTexts(NpcGennai.title),
    portrait: NpcGennai.portrait
  },

  text: getTexts('ITDW_007'),

  actions: [
    {
      id: 'ITDW_007_CONTINUE',

      text: getTexts('SCENES_CONTINUE_BUTTON'),

      onClick: () => {
        const { setDialog } = useDialogStore.getState()
        setDialog(IntoTheDigitalWorld008)
      }
    }
  ]
} satisfies DialogType
