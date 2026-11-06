import { Link } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import type { CommunityForumEntryProps } from './CommunityForumEntry.types'

export function CommunityForumEntry({
  author,
  content,
  createdAt,
  className,
  unknownAuthorLabel,
  children
}: CommunityForumEntryProps) {
  return (
    <article className={className}>
      <aside className="community-forum__author-column">
        {author ? (
          <Link
            className="community-forum__author-link"
            to={ROUTES.profile + '/' + author.url}
            aria-label={author.name}
            title={author.name}
          >
            <span className="community-forum__author-avatar">
              {author.picture ? (
                <img src={author.picture} alt="" />
              ) : (
                <span aria-hidden="true">
                  {author.name.trim().charAt(0).toUpperCase()}
                </span>
              )}
            </span>
          </Link>
        ) : (
          <span className="community-forum__author-avatar" aria-hidden="true">
            ?
          </span>
        )}
      </aside>
      <div className="community-forum__entry-main">
        <header className="community-forum__post-header">
          <span>
            {author ? (
              <Link to={ROUTES.profile + '/' + author.url}>{author.name}</Link>
            ) : (
              unknownAuthorLabel
            )}
          </span>
          <time dateTime={new Date(createdAt).toISOString()}>
            {new Date(createdAt).toLocaleString()}
          </time>
        </header>
        <div
          className="community-forum__post-content rich-text-content"
          dangerouslySetInnerHTML={{ __html: content }}
        />
        {children}
      </div>
    </article>
  )
}
