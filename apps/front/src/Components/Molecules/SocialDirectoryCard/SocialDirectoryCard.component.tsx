import type { ReactNode } from 'react'
import { Link } from 'react-router'

type SocialDirectoryCardProps = {
  name: string
  picture: string
  href: string
  meta?: string
  actionLabel: string
  actions?: ReactNode
}

export function SocialDirectoryCard({ name, picture, href, meta, actionLabel, actions }: SocialDirectoryCardProps) {
  return (
    <article className="social-directory-card">
      <Link className="social-directory-card__identity" to={href}>
        <span className="social-directory-card__avatar">
          {picture
            ? <img src={picture} alt="" />
            : <span aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>}
        </span>
        <span className="social-directory-card__name">{name}</span>
        {meta && <span className="social-directory-card__meta">{meta}</span>}
      </Link>
      <div className="social-directory-card__footer">
        <Link className="social-directory-card__action" to={href}>{actionLabel}</Link>
        {actions}
      </div>
    </article>
  )
}
