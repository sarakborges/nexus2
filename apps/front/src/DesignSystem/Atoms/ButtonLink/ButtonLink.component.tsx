import type { ButtonVariation } from '../Button/Button.component'
import { useIsFetching, useIsMutating } from '@tanstack/react-query'

import type { MouseEvent } from 'react'
import { Link, type LinkProps } from 'react-router'

import '../Button/Button.style.scss'

type ButtonLinkProps = LinkProps & {
  variation?: ButtonVariation
}

export function ButtonLink({
  children,
  className,
  variation = 'primary',
  onClick,
  tabIndex,
  ...props
}: ButtonLinkProps) {
  const isFetching = useIsFetching() > 0
  const isMutating = useIsMutating() > 0
  const isRequestPending = isFetching || isMutating
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
