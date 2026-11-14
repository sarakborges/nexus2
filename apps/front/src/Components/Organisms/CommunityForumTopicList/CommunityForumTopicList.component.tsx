import type { CommunityForumTopicListProps } from './CommunityForumTopicList.types'
import './CommunityForumTopicList.style.scss'

import { Link } from 'react-router'

import { IdentityAvatar } from '@/Components/Molecules'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'

export function CommunityForumTopicList({
  communityUrl,
  topics,
  authorsById
}: CommunityForumTopicListProps) {
  const { t } = useTranslations()

  return (
    <div className="community-forum-topic-list">
      {topics.map((topic) => {
        const author = authorsById.get(topic.profileId)
        return (
          <article className="community-forum__topic" key={topic.id}>
            <div className="community-forum-topic-list__author">
              {author ? (
                <Link
                  to={ROUTES.profile + '/' + author.url}
                  aria-label={author.name}
                  title={author.name}
                >
                  <IdentityAvatar
                    className="community-forum-topic-list__avatar"
                    name={author.name}
                    picture={author.picture}
                  />
                </Link>
              ) : (
                <span
                  className="community-forum-topic-list__avatar"
                  aria-hidden="true"
                >
                  ?
                </span>
              )}
            </div>
            <div className="community-forum-topic-list__main">
              <div className="community-forum-topic-list__labels">
                {topic.isLocked && (
                  <span className="community-forum-topic-list__label">
                    {t('FORUM_LOCKED')}
                  </span>
                )}
                {topic.isPinned && (
                  <span className="community-forum-topic-list__label">
                    {t('FORUM_PINNED')}
                  </span>
                )}
              </div>
              <Link
                className="community-forum-topic-list__title"
                to={
                  ROUTES.community + '/' + communityUrl + '/forum/' + topic.id
                }
              >
                {topic.title}
              </Link>
              <div className="community-forum-topic-list__meta">
                <span>
                  {author ? (
                    <Link to={ROUTES.profile + '/' + author.url}>
                      {author.name}
                    </Link>
                  ) : (
                    t('FORUM_UNKNOWN_AUTHOR')
                  )}
                </span>
              </div>
            </div>
            <div className="community-forum-topic-list__stats">
              <span className="community-forum-topic-list__reply-count">
                {topic.replyCount} {t('FORUM_REPLIES')}
              </span>
              <time
                className="community-forum-topic-list__last-post"
                dateTime={new Date(topic.updatedAt).toISOString()}
              >
                {new Date(topic.updatedAt).toLocaleString()}
              </time>
            </div>
          </article>
        )
      })}
    </div>
  )
}
