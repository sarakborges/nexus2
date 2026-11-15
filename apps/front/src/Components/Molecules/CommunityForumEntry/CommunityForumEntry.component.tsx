import { Link } from 'react-router'

import { IdentityAvatar } from '@/Components/Atoms/IdentityAvatar'
import { RichTextContent } from '@/DesignSystem'
import { ROUTES } from '@/Constants/routes'
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
            <IdentityAvatar
              className="community-forum-entry__author-avatar"
              name={author.name}
              picture={author.picture}
            />
          </Link>
        ) : (
          <IdentityAvatar
            className="community-forum-entry__author-avatar"
            name="?"
            picture=""
          />
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
