import { FashionTrigger } from '@/GameData/Dialogs/Apps/Fashion/Trigger.dialog'

import { useDialogStore } from '@/Stores/Dialog.store'

import { Button } from '@/Components/DesignSystem/Button'

import './RootDomainDormsFashionTerminal.style.scss'

export const RootDomainDormsFashionTerminal = () => {
  const { dialog, setDialog } = useDialogStore((state) => state)

  const openFashion = () => {
    setDialog(FashionTrigger)
  }

  return (
    <Button
      className="fashion-terminal"
      onClick={openFashion}
      disabled={!!dialog}
    />
  )
}
