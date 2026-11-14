import { Link } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import { RichTextContent } from '@/DesignSystem'
import type { CommunityForumEntryProps } from './CommunityForumEntry.types'
import './CommunityForumEntry.style.scss'

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
      <aside className="community-forum-entry__author-column">
        {author ? (
          <Link
            className="community-forum-entry__author-link"
            to={ROUTES.profile + '/' + author.url}
            aria-label={author.name}
            title={author.name}
          >
            <span className="community-forum-entry__author-avatar">
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
          <span className="community-forum-entry__author-avatar" aria-hidden="true">
            ?
          </span>
        )}
      </aside>
      <div className="community-forum-entry__main">
        <header className="community-forum-entry__header">
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
        <RichTextContent
          className="community-forum-entry__content"
          html={content}
        />
        {children}
      </div>
    </article>
  )
}
