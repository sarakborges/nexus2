import { Link } from 'react-router'

import { IdentityAvatar } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import type { HomePageActivityEntryProps } from './HomePageActivityEntry.types'

export function HomePageActivityEntry({
  activity,
  formatDate
}: HomePageActivityEntryProps) {
  const { t } = useTranslations()
  const profileHref = `${ROUTES.profile}/${activity.profile.url}`

  return (
    <article className="home-page__activity-item">
      <header className="home-page__activity-header">
        <Link
          className="home-page__activity-avatar-link"
          to={profileHref}
          aria-label={activity.profile.name}
          title={activity.profile.name}
        >
          <IdentityAvatar
            className="home-page__activity-avatar"
            name={activity.profile.name}
            picture={activity.profile.picture}
          />
        </Link>
        <div className="home-page__activity-author">
          <Link
            className="home-page__activity-author-name"
            to={profileHref}
          >
            {activity.profile.name}
          </Link>
          <time dateTime={new Date(activity.updatedAt).toISOString()}>
            {formatDate(activity.updatedAt)}
          </time>
        </div>
      </header>
      {activity.type === 'friend_connected' ? (
        <p className="home-page__activity-description">
          <span>{t('HOME_ACTIVITY_PROFILE_PREFIX')} </span>
          <Link to={profileHref}>{activity.profile.name}</Link>
          <span> {t('HOME_ACTIVITY_FRIEND_CONNECTOR')} </span>
          <Link to={`${ROUTES.profile}/${activity.friend.url}`}>
            {activity.friend.name}
          </Link>
        </p>
      ) : (
        <p className="home-page__activity-description">
          <span>{t('HOME_ACTIVITY_PROFILE_PREFIX')} </span>
          <Link to={profileHref}>{activity.profile.name}</Link>
          <span>
            {' '}
            {t(
              activity.role === 'owner'
                ? 'HOME_ACTIVITY_COMMUNITY_OWNER'
                : activity.role === 'moderator'
                  ? 'HOME_ACTIVITY_COMMUNITY_MODERATOR'
                  : 'HOME_ACTIVITY_COMMUNITY_MEMBER'
            )}{' '}
          </span>
          <Link to={`${ROUTES.community}/${activity.community.url}`}>
            {activity.community.name}
          </Link>
        </p>
      )}
    </article>
  )
}
