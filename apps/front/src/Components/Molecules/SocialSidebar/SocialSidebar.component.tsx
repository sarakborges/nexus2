import { Link } from 'react-router'
import { IdentityAvatar } from '@/Components/Molecules/IdentityAvatar'
import type { SocialSidebarProps } from './SocialSidebar.types'

import './SocialSidebar.style.scss'

export function SocialSidebar({
  href,
  imageLabel,
  name,
  picture,
  pictureVariant,
  metadata,
  relationshipActions,
  navigationLabel,
  navigationItems
}: SocialSidebarProps) {
  return (
    <div className="social-sidebar-card">
      <section className="social-identity">
        <Link className="social-identity__link" to={href} aria-label={imageLabel}>
          <IdentityAvatar
            className={`social-identity__picture social-identity__picture--${pictureVariant}`}
            name={name}
            picture={picture}
          />
        </Link>
        <h1 className="social-identity__name">{name}</h1>
        {metadata && <span className="social-identity__url">{metadata}</span>}
        {relationshipActions}
      </section>
      <nav className="social-side-menu" aria-label={navigationLabel}>
        {navigationItems.map(item => (
          <Link
            key={item.href}
            to={item.href}
            aria-current={item.isActive ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
