import { useGameStore } from '@/Stores/Game.store'

export const loadGame = () => {
  const { setGame } = useGameStore.getState()

  setGame({
    isTransitioning: true
  })

  setTimeout(() => {
    setGame({
      isTransitioning: false,
      hasGameStarted: true
    })
  }, 600)
}
