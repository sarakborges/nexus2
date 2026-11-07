import type { ReactNode } from 'react'

export type FloatingNavigationLinkProps = {
  to: string
  className: string
  icon: ReactNode
  label: string
  isActive?: boolean
  onNavigate: () => void
}
