import { Link } from 'react-router'

import type { FloatingNavigationLinkProps } from './FloatingNavigationLink.types'

export function FloatingNavigationLink({
  to,
  className,
  icon,
  label,
  isActive = false,
  onNavigate
}: FloatingNavigationLinkProps) {
  return (
    <Link
      className={className}
      to={to}
      aria-current={isActive ? 'page' : undefined}
      onClick={onNavigate}
    >
      {icon}
      <span>{label}</span>
    </Link>
  )
}
