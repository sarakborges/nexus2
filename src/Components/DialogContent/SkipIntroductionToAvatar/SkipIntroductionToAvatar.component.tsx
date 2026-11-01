import { FashionIntroduction } from '@/GameData/Dialogs/Apps/Fashion/Introduction.dialog'

import { getTexts } from '@/Helpers/Language'

import { useDialogStore } from '@/Stores/Dialog.store'

// import { useSavedProfilesStore } from '@/Stores/SavedProfiles.store'

import { ShadowButton } from '@/Components/DesignSystem/ShadowButton'

import './SkipIntroductionToAvatar.style.scss'

export const SkipIntroductionToAvatar = () => {
  // const { savedProfiles } = useSavedProfilesStore.getState()
  const { setDialog } = useDialogStore((state) => state)

  // if (!savedProfiles) {
  //   return <></>
  // }

  return (
    <div className="skip-introduction">
      <ShadowButton onClick={() => setDialog(FashionIntroduction)}>
        {getTexts('ITDW_012_SKIP')}
      </ShadowButton>
    </div>
  )
}
