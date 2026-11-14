import type { MouseEvent } from 'react'
import { Link } from 'react-router'

import type { ButtonLinkProps } from './ButtonLink.types'

import '../Button/Button.style.scss'

export function ButtonLink({
  children,
  className,
  variation = 'primary',
  onClick,
  disabled = false,
  tabIndex,
  ...props
}: ButtonLinkProps) {
  const classNames = ['button', `button--${variation}`, className]
    .filter(Boolean)
    .join(' ')

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (disabled) {
      event.preventDefault()
      return
    }
    onClick?.(event)
  }

  return (
    <Link
      className={classNames}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : tabIndex}
      onClick={handleClick}
      {...props}
    >
      {children}
    </Link>
  )
}
