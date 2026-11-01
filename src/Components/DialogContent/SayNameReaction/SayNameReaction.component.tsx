import { getIntoTheDigitalWorld011 } from '@/GameData/Dialogs/Story/IntoTheDigitalWorld/011.dialog'

import { getTexts } from '@/Helpers/Language'
import { setMeaningfulChoice } from '@/Helpers/Systems/Dialogs'

import { useDialogStore } from '@/Stores/Dialog.store'

import { ShadowButton } from '@/Components/DesignSystem/ShadowButton'

import './SayNameReaction.style.scss'

const reactionOptions = [
  'calm',
  'friendly',
  'wary',
  'nervous',
  'blunt',
  'curious',
  'playful'
] as const

type NameReaction = (typeof reactionOptions)[number]

export const SayNameReaction = () => {
  const { setDialog } = useDialogStore((state) => state)

  const handleReaction = (reaction: NameReaction) => {
    setMeaningfulChoice({
      choice: 'INTO_THE_DIGITAL_WORLD_NAME_REACTION',
      value: reaction
    })

    setDialog(getIntoTheDigitalWorld011())
  }

  return (
    <div className="say-name-reaction">
      {reactionOptions.map((option) => (
        <ShadowButton
          key={`say-name-reaction-${option}`}
          onClick={() => handleReaction(option)}
        >
          {getTexts(`ITDW_010_${option.toUpperCase()}`)}
        </ShadowButton>
      ))}
    </div>
  )
}
