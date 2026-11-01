import { useGameStore } from '@/Stores/Game.store'
import { useProfileStore } from '@/Stores/Profile.store'

export const changeScene = (scene: string | null) => {
  const { game, setGame } = useGameStore.getState()
  const { profile, patchProfile } = useProfileStore.getState()

  if (!game) {
    return
  }

  setGame({
    ...game,
    isTransitioning: true
  })

  setTimeout(() => {
    setGame({
      ...game,
      isTransitioning: false
    })

    patchProfile({
      lastScene: profile.currentScene,
      currentScene: scene
    })
  }, 600)
}
