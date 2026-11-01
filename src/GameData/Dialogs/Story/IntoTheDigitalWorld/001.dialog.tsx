import type { DialogType } from '@/Types/Dialog.type'

import { IntoTheDigitalWorld002 } from '@/GameData/Dialogs/Story/IntoTheDigitalWorld/002.dialog'

import { getTexts } from '@/Helpers/Language'
import { changeScene } from '@/Helpers/Systems/Scenes'

import { useDialogStore } from '@/Stores/Dialog.store'

import { SkipIntroductionToName } from '@/Components/DialogContent/SkipIntroductionToName'

export const IntoTheDigitalWorld001 = {
  text: getTexts('ITDW_001'),

  content: <SkipIntroductionToName />,

  actions: [
    {
      id: 'ITDW_001_CONTINUE',

      text: getTexts('SCENES_CONTINUE_BUTTON'),

      onClick: () => {
        const { setDialog } = useDialogStore.getState()

        changeScene('rootDomainDorms')
        setDialog(IntoTheDigitalWorld002)
      }
    }
  ]
} satisfies DialogType
