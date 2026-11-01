import { AllScenes } from '@/GameData/Scenes'

import { useProfileStore } from '@/Stores/Profile.store'

import './Scene.style.scss'

export const Scene = () => {
  const { profile } = useProfileStore((state) => state)

  if (!profile.currentScene) {
    return <></>
  }

  const RenderedScene = AllScenes[profile.currentScene] as React.FC

  return (
    <div className="scene">
      <RenderedScene />
    </div>
  )
}
