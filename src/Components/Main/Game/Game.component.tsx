import { type CSSProperties, useEffect } from 'react'

import { loadGameSession } from '@/Helpers/Systems/Data'

import { useGameStore } from '@/Stores/Game.store'

import { Dialog } from '@/Components/Main/Dialog'
import { Scene } from '@/Components/Main/Scene'
import { ScreenOrientationWarning } from '@/Components/Main/ScreenOrientationWarning'

import './Game.style.scss'

export const Game = () => {
  const { game } = useGameStore((state) => state)

  useEffect(() => {
    loadGameSession()
  }, [])

  return (
    <div
      className="game-body"
      style={
        { '--is-warping': !!game?.isTransitioning ? 0 : 1 } as CSSProperties
      }
    >
      <ScreenOrientationWarning />

      <main className="main-game">
        <Scene />
        <Dialog />
      </main>
    </div>
  )
}
