import { IntoTheDigitalWorld009 } from '@/GameData/Dialogs/Story/IntoTheDigitalWorld/009.dialog'

import { getTexts } from '@/Helpers/Language'
import { changeScene } from '@/Helpers/Systems/Scenes'

import { useDialogStore } from '@/Stores/Dialog.store'

// import { useSavedProfilesStore } from '@/Stores/SavedProfiles.store'

import { ShadowButton } from '@/Components/DesignSystem/ShadowButton'

import './SkipIntroductionToName.style.scss'

export const SkipIntroductionToName = () => {
  // const { savedProfiles } = useSavedProfilesStore.getState()
  const { setDialog } = useDialogStore((state) => state)

  const skipToName = () => {
    changeScene('rootDomainDorms')
    setDialog(IntoTheDigitalWorld009)
  }

  // if (!savedProfiles) {
  //   return <></>
  // }

  return (
    <div className="skip-introduction">
      <ShadowButton onClick={skipToName}>
        {getTexts('ITDW_001_SKIP')}
      </ShadowButton>
    </div>
  )
}
