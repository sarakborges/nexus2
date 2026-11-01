import { useGameStore } from '@/Stores/Game.store'
import { useProfileStore } from '@/Stores/Profile.store'

import { RootDomainDormsFashionTerminal } from '@/Components/Scenes/RootDomainDormsFashionTerminal'

import './RootDomainDorms.style.scss'

export const RootDomainDorms = () => {
  const { profile } = useProfileStore((state) => state)
  const { game } = useGameStore((state) => state)

  if (!game?.hasGameStarted || !profile) {
    return
  }

  return (
    <main className="root-domain-dorms">
      <RootDomainDormsFashionTerminal />
    </main>
  )
}
