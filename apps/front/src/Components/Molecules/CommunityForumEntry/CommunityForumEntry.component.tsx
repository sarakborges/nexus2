import { IdentityAvatar } from '@/Components/Atoms/IdentityAvatar'
import { IdentityAvatarLink } from '@/Components/Molecules/IdentityAvatarLink'
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
          <IdentityAvatarLink
            className="community-forum-entry__author-link"
            to={ROUTES.profile + '/' + author.url}
            name={author.name}
            picture={author.picture}
            avatarClassName="community-forum-entry__author-avatar"
          />
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
              <a href={ROUTES.profile + '/' + author.url}>{author.name}</a>
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
