import type { ButtonHTMLAttributes } from 'react'

import { useGameStore } from '@/Stores/Game.store'

import './ShadowButton.style.scss'

export const ShadowButton: React.FC<
  ButtonHTMLAttributes<HTMLButtonElement>
> = ({ children, ...rest }) => {
  const { game } = useGameStore((state) => state)

  return (
    <button
      className="shadow-button"
      {...rest}
      disabled={rest.disabled || !!game?.isTransitioning}
    >
      <div className="button-content">{children}</div>

      <div className="button-bg">
        <div />
        <div />
      </div>
    </button>
  )
}
