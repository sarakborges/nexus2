import { getTexts } from '@/Helpers/Language'

import { Text } from '@/Components/DesignSystem/Text'

import './ScreenOrientationWarning.style.scss'

export const ScreenOrientationWarning = () => {
  return (
    <div className="warning-container">
      <div className="screen-orientation-warning">
        <Text as="p">{getTexts('START_SCREEN_TITLE')}</Text>

        <div>
          <Text as="p">{getTexts('SCREEN_ORIENTATION_WARNING')}</Text>
        </div>
      </div>
    </div>
  )
}
