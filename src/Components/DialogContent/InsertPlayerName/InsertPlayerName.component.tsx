import { useState } from 'react'

import { getIntoTheDigitalWorld010 } from '@/GameData/Dialogs/Story/IntoTheDigitalWorld/010.dialog'

import { getTexts } from '@/Helpers/Language'

import { useDialogStore } from '@/Stores/Dialog.store'
import { useProfileStore } from '@/Stores/Profile.store'

import { Button } from '@/Components/DesignSystem/Button'
import { Input } from '@/Components/DesignSystem/Input'

import './InsertPlayerName.style.scss'

export const InsertPlayerName = () => {
  const [playerName, setPlayerName] = useState('')

  const { patchProfile } = useProfileStore((state) => state)
  const { setDialog } = useDialogStore((state) => state)

  const normalizedPlayerName = playerName.trim()

  const handleFormSubmit = () => {
    if (!normalizedPlayerName) {
      return
    }

    patchProfile({
      name: normalizedPlayerName
    })

    setDialog(getIntoTheDigitalWorld010())
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        handleFormSubmit()
      }}
      className="insert-player-name"
    >
      <main>
        <Input
          name="insert-player-name"
          label={getTexts('ITDW_009')}
          value={playerName}
          autoFocus
          onChange={(e) => setPlayerName(e.target.value)}
        />
      </main>

      <footer>
        <Button disabled={!normalizedPlayerName}>
          {getTexts('SCENES_CONFIRM_BUTTON')}
        </Button>
      </footer>
    </form>
  )
}
