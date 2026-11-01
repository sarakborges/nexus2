import type { DialogType } from '@/Types/Dialog.type'

import { IntoTheDigitalWorld023 } from '@/GameData/Dialogs/Story/IntoTheDigitalWorld/023.dialog'
import { NpcGennai } from '@/GameData/Npcs/Gennai.npc'

import { getTexts } from '@/Helpers/Language'

import { useDialogStore } from '@/Stores/Dialog.store'

export const IntoTheDigitalWorld022 = {
  speaker: {
    id: NpcGennai.id,
    name: NpcGennai.name,
    title: getTexts(NpcGennai.title),
    portrait: NpcGennai.portrait
  },

  text: getTexts('ITDW_022'),

  actions: [
    {
      id: 'ITDW_022_CONTINUE',

      text: getTexts('SCENES_CONTINUE_BUTTON'),

      onClick: () => {
        const { setDialog } = useDialogStore.getState()
        setDialog(IntoTheDigitalWorld023())
      }
    }
  ]
} satisfies DialogType
