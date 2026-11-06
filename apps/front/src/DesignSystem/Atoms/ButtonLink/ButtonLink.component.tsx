import type { MouseEvent } from 'react'
import { Link } from 'react-router'

import type { ButtonLinkProps } from './ButtonLink.types'
import { useGlobalRequestStatus } from '../../Hooks/useGlobalRequestStatus'

import '../Button/Button.style.scss'

export function ButtonLink({
  children,
  className,
  variation = 'primary',
  onClick,
  tabIndex,
  ...props
}: ButtonLinkProps) {
  const isRequestPending = useGlobalRequestStatus()
  const classNames = ['button', `button--${variation}`, className]
    .filter(Boolean)
    .join(' ')

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (isRequestPending) {
      event.preventDefault()
      return
    }
    onClick?.(event)
  }

  return (
    <Link
      className={classNames}
      aria-disabled={isRequestPending || undefined}
      aria-busy={isRequestPending || undefined}
      tabIndex={isRequestPending ? -1 : tabIndex}
      onClick={handleClick}
      {...props}
    >
      {children}
    </Link>
  )
}
