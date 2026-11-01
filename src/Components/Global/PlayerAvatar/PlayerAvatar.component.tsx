import type { CSSProperties } from 'react'

import './PlayerAvatar.style.scss'

export const PlayerAvatar = () => {
  return (
    <div className="player-avatar">
      <div className="avatar-content">
        <div className="avatar-layers">
          <div
            className="avatar-layer skin"
            style={
              {
                '--skin-color': 'hsl(28 45% 72%)',
                '--skin-brightness': '1.25',
                '--skin-contrast': '1'
              } as React.CSSProperties
            }
          />

          <div
            className="avatar-layer hair"
            style={
              {
                '--hair-image': 'url(/avatars/hairs/2.png)',
                '--hair-brightness': '1',
                '--hair-contrast': '1',
                '--hair-color': 'hsl(199.7 69.1% 40.6%)'
              } as CSSProperties
            }
          />
        </div>
      </div>
    </div>
  )
}
