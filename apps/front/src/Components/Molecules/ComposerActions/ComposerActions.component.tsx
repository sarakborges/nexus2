import type { ComposerActionsProps } from './ComposerActions.types'

import './ComposerActions.style.scss'

export function ComposerActions({
  children,
  className,
  ...props
}: ComposerActionsProps) {
  return (
    <div
      className={['composer-actions', className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </div>
  )
}
