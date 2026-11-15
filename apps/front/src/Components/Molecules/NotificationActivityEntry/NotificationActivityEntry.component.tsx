import { Link } from 'react-router'
import type { RecentActivity } from '@nexus/common'

import { IdentityAvatar } from '@/Components/Atoms/IdentityAvatar'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'

import type { NotificationActivityEntryProps } from './NotificationActivityEntry.types'
import './NotificationActivityEntry.style.scss'

function getActivityHref(activity: RecentActivity): string {
  if (
    activity.type === 'community_created' ||
    activity.type === 'community_membership'
  ) {
    return ROUTES.community + '/' + activity.community.url
  }

  return ROUTES.profile + '/' + activity.profile.url
}

export function NotificationActivityEntry({
  activity,
  onClick
}: NotificationActivityEntryProps) {
  const { t } = useTranslations()

  const description = (() => {
    switch (activity.type) {
      case 'friend_connected':
        return (
          <>
            {activity.profile.name} {t('NOTIFICATION_FRIEND_CONNECTED')}{' '}
            {activity.friend.name}
          </>
        )
      case 'profile_post':
        return (
          <>
            {activity.profile.name} {t('NOTIFICATION_PROFILE_POST')}
          </>
        )
      case 'community_created':
        return (
          <>
            {activity.profile.name} {t('NOTIFICATION_COMMUNITY_CREATED')}{' '}
            {activity.community.name}
          </>
        )
      case 'community_membership':
        return (
          <>
            {activity.profile.name} {t('NOTIFICATION_COMMUNITY_JOINED')}{' '}
            {activity.community.name}
          </>
        )
    }
  })()

  return (
    <Link
      className="notification-activity-entry"
      to={getActivityHref(activity)}
      onClick={onClick}
    >
      <IdentityAvatar
        className="notification-activity-entry__avatar"
        name={activity.profile.name}
        picture={activity.profile.picture}
      />
      <span className="notification-activity-entry__copy">
        <strong>{activity.profile.name}</strong>
        <small>@{activity.profile.url}</small>
        <span>{description}</span>
        <time dateTime={new Date(activity.updatedAt).toISOString()}>
          {new Date(activity.updatedAt).toLocaleString()}
        </time>
      </span>
    </Link>
  )
}
