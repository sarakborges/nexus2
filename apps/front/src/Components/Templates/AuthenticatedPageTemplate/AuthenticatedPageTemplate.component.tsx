import type { AuthenticatedPageTemplateProps } from './AuthenticatedPageTemplate.types'

import './AuthenticatedPageTemplate.style.scss'

export function AuthenticatedPageTemplate({
  children,
  className,
  ...props
}: AuthenticatedPageTemplateProps) {
  const classNames = ['account-page', className].filter(Boolean).join(' ')

  return (
    <main className={classNames} {...props}>
      {children}
    </main>
  )
}
