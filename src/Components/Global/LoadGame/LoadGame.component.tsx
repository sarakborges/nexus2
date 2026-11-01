import { getTexts } from '@/Helpers/Language'
import { loadData, saveSession } from '@/Helpers/Systems/Data'

import { Button } from '@/Components/DesignSystem/Button'

export const LoadGame = ({ profileId }: { profileId: number }) => {
  const loadProfile = () => {
    const loadedProfile = loadData(`profile${profileId}`)

    if (!loadedProfile) {
      return
    }

    saveSession(loadedProfile)
  }

  return <Button onClick={loadProfile}>{getTexts('LOAD_GAME')}</Button>
}
