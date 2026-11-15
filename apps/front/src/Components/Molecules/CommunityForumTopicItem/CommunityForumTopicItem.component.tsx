import { Link } from 'react-router'
import { IdentityAvatar } from '@/Components/Atoms/IdentityAvatar'
import { IdentityAvatarLink } from '@/Components/Atoms/IdentityAvatarLink'
import { Badge } from '@/DesignSystem'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'

import type { CommunityForumTopicItemProps } from './CommunityForumTopicItem.types'

import './CommunityForumTopicItem.style.scss'

export function CommunityForumTopicItem({
  topic,
  communityUrl,
  author
}: CommunityForumTopicItemProps) {
  const { t } = useTranslations()

  return (
    <article className="community-forum-topic-item">
      <div className="community-forum-topic-item__author">
        {author ? (
          <IdentityAvatarLink
            to={ROUTES.profile + '/' + author.url}
            name={author.name}
            picture={author.picture}
            avatarClassName="community-forum-topic-item__avatar"
          />
        ) : (
          <IdentityAvatar
            className="community-forum-topic-item__avatar"
            name="?"
            picture=""
          />
        )}
      </div>
      <div className="community-forum-topic-item__main">
        <div className="community-forum-topic-item__labels">
          {topic.isLocked && <Badge tone="warning">{t('FORUM_LOCKED')}</Badge>}
          {topic.isPinned && <Badge>{t('FORUM_PINNED')}</Badge>}
        </div>
        <Link
          className="community-forum-topic-item__title"
          to={ROUTES.community + '/' + communityUrl + '/forum/' + topic.id}
        >
          {topic.title}
        </Link>
        <div className="community-forum-topic-item__meta">
          <span>
            {author ? (
              <Link to={ROUTES.profile + '/' + author.url}>{author.name}</Link>
            ) : (
              t('FORUM_UNKNOWN_AUTHOR')
            )}
          </span>
        </div>
      </div>
      <div className="community-forum-topic-item__stats">
        <span className="community-forum-topic-item__reply-count">
          {topic.replyCount} {t('FORUM_REPLIES')}
        </span>
        <time
          className="community-forum-topic-item__last-post"
          dateTime={new Date(topic.updatedAt).toISOString()}
        >
          {new Date(topic.updatedAt).toLocaleString()}
        </time>
      </div>
    </article>
  )
}
