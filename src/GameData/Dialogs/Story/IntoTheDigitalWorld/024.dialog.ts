import type { DialogType } from '@/Types/Dialog.type'

import { IntoTheDigitalWorld025 } from '@/GameData/Dialogs/Story/IntoTheDigitalWorld/025.dialog'
import { NpcGennai } from '@/GameData/Npcs/Gennai.npc'

import { getTexts } from '@/Helpers/Language'

import { useDialogStore } from '@/Stores/Dialog.store'

export const getIntoTheDigitalWorld024 = (): DialogType => {
  return {
    speaker: {
      id: NpcGennai.id,
      name: NpcGennai.name,
      title: getTexts(NpcGennai.title),
      portrait: NpcGennai.portrait
    },

    text: getTexts('ITDW_024'),

    actions: [
      {
        id: 'ITDW_024_CONTINUE',

        text: getTexts('SCENES_CONTINUE_BUTTON'),

        onClick: () => {
          const { setDialog } = useDialogStore.getState()
          setDialog(IntoTheDigitalWorld025)
        }
      }
    ]
  }
}
