import { getIntoTheDigitalWorld014 } from '@/GameData/Dialogs/Story/IntoTheDigitalWorld/014.dialog'
import { getIntoTheDigitalWorld015 } from '@/GameData/Dialogs/Story/IntoTheDigitalWorld/015.dialog'

import { getTexts } from '@/Helpers/Language'

import { useDialogStore } from '@/Stores/Dialog.store'
import { useDialogOptionsStore } from '@/Stores/DialogOptions.store'

import { ShadowButton } from '@/Components/DesignSystem/ShadowButton'

import './GennaiExplanationTopic.style.scss'

export const GennaiExplanationTopic = () => {
  const { dialogOptions, setDialogOptions } = useDialogOptionsStore(
    (state) => state
  )
  const { setDialog } = useDialogStore((state) => state)

  const handleTopic = (topic: string) => {
    if (topic === 'enough') {
      setDialog(getIntoTheDigitalWorld015())
      setTimeout(() => setDialogOptions([]), 600)
      return
    }

    setDialog(getIntoTheDigitalWorld014(topic))

    setTimeout(
      () =>
        setDialogOptions(
          dialogOptions.filter((dialogOption) => dialogOption !== topic)
        ),
      600
    )
  }

  return (
    <div className="gennai-explanation-topic">
      {dialogOptions.map((option) => (
        <ShadowButton
          key={`gennai-explanation-topic-${option}`}
          onClick={() => handleTopic(option)}
        >
          {getTexts(`ITDW_013_${option.toUpperCase()}`)}
        </ShadowButton>
      ))}
    </div>
  )
}
