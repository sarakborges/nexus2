import { Link } from 'react-router'
import { IdentityAvatarLink } from '@/Components/Atoms/IdentityAvatarLink'
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
        <IdentityAvatarLink
          className="social-identity__link"
          to={href}
          ariaLabel={imageLabel}
          name={name}
          picture={picture}
          avatarClassName={`social-identity__picture social-identity__picture--${pictureVariant}`}
        />
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
