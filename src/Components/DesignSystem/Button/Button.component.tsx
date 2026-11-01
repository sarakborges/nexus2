import type { ButtonHTMLAttributes } from 'react'

import { useGameStore } from '@/Stores/Game.store'

import './Button.style.scss'

type ButtonType = {
  variant?: 'primary' | 'secondary' | 'cancel'
} & ButtonHTMLAttributes<HTMLButtonElement>

export const Button: React.FC<ButtonType> = ({
  children,
  className,
  variant,
  ...rest
}) => {
  const { game } = useGameStore((state) => state)

  const classNames = ['button']

  if (variant === 'primary' || !variant) {
    classNames.push('primary')
  }

  if (variant === 'secondary') {
    classNames.push('secondary')
  }

  if (variant === 'cancel') {
    classNames.push('cancel')
  }

  if (className) {
    classNames.push(className)
  }

  return (
    <button
      className={classNames.join(' ')}
      {...rest}
      disabled={rest.disabled || !!game?.isTransitioning}
    >
      {children}
    </button>
  )
}
