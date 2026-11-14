import type { AccountCardProps } from './AccountCard.types'

import './AccountCard.style.scss'

export function AccountCard({ children, className, ...props }: AccountCardProps) {
  const classNames = ['account-card', className].filter(Boolean).join(' ')

  return (
    <section className={classNames} {...props}>
      {children}
    </section>
  )
}
