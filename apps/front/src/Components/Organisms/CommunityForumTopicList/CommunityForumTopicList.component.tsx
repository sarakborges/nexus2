import type { CommunityForumTopicSummary, Profile } from '@nexus/common'

import { Link } from 'react-router'

import { IdentityAvatar } from '@/Components/Molecules'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'

type CommunityForumTopicListProps = {
  communityUrl: string
  topics: CommunityForumTopicSummary[]
  authorsById: ReadonlyMap<string, Profile>
}

export function CommunityForumTopicList({
  communityUrl,
  topics,
  authorsById
}: CommunityForumTopicListProps) {
  const { t } = useTranslations()

  return (
    <div className="community-forum__topics">
      {topics.map((topic) => {
        const author = authorsById.get(topic.profileId)
        return (
          <article className="community-forum__topic" key={topic.id}>
            <div className="community-forum__topic-author">
              {author ? (
                <Link
                  to={ROUTES.profile + '/' + author.url}
                  aria-label={author.name}
                  title={author.name}
                >
                  <IdentityAvatar
                    className="community-forum__author-avatar"
                    name={author.name}
                    picture={author.picture}
                  />
                </Link>
              ) : (
                <span
                  className="community-forum__author-avatar"
                  aria-hidden="true"
                >
                  ?
                </span>
              )}
            </div>
            <div className="community-forum__topic-main">
              <div className="community-forum__topic-labels">
                {topic.isLocked && (
                  <span className="community-forum__label">
                    {t('FORUM_LOCKED')}
                  </span>
                )}
                {topic.isPinned && (
                  <span className="community-forum__label">
                    {t('FORUM_PINNED')}
                  </span>
                )}
              </div>
              <Link
                className="community-forum__topic-title"
                to={
                  ROUTES.community + '/' + communityUrl + '/forum/' + topic.id
                }
              >
                {topic.title}
              </Link>
              <div className="community-forum__topic-meta">
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
            <div className="community-forum__topic-stats">
              <span className="community-forum__reply-count">
                {topic.replyCount} {t('FORUM_REPLIES')}
              </span>
              <time
                className="community-forum__topic-last-post"
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
