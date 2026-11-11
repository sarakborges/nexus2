import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import type { RecentActivity } from '@nexus/common'
import { FiBell } from 'react-icons/fi'

import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { getCurrentAuthSession } from '@/Services/Auth'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'

type NotificationsMenuProps = {
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}

function getActivityHref(activity: RecentActivity): string {
  if (activity.type === 'community_created' || activity.type === 'community_membership') {
    return ROUTES.community + '/' + activity.community.url
  }
  return ROUTES.profile + '/' + activity.profile.url
}

export function NotificationsMenu({
  isOpen,
  onToggle,
  onClose
}: NotificationsMenuProps) {
  const { t } = useTranslations()
  const session = useAuthStore(state => state.session)
  const userId = session?.user.id ?? null
  const activityQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: getCurrentAuthSession,
    enabled: Boolean(userId),
    initialData: session ?? undefined,
    staleTime: 30_000
  })
  const activities = activityQuery.data?.activities.slice(0, 8) ?? []

  const renderActivity = (activity: RecentActivity) => {
    switch (activity.type) {
      case 'friend_connected':
        return <>{activity.profile.name} {t('NOTIFICATION_FRIEND_CONNECTED')} {activity.friend.name}</>
      case 'profile_post':
        return <>{activity.profile.name} {t('NOTIFICATION_PROFILE_POST')}</>
      case 'community_created':
        return <>{activity.profile.name} {t('NOTIFICATION_COMMUNITY_CREATED')} {activity.community.name}</>
      case 'community_membership':
        return <>{activity.profile.name} {t('NOTIFICATION_COMMUNITY_JOINED')} {activity.community.name}</>
    }
  }

  return (
    <>
      <button
        className="floating-navigation__notification-trigger"
        type="button"
        aria-label={t('NOTIFICATIONS_BUTTON')}
        aria-expanded={isOpen}
        aria-controls="floating-notifications-menu"
        onClick={onToggle}
      >
        <FiBell aria-hidden="true" />
        {activities.length > 0 && (
          <span className="floating-navigation__notification-count">
            {activities.length > 9 ? '9+' : activities.length}
          </span>
        )}
      </button>

      {isOpen && (
        <section
          className="floating-navigation__menu floating-navigation__menu--notifications"
          id="floating-notifications-menu"
          aria-label={t('NOTIFICATIONS_TITLE')}
        >
          <header className="floating-navigation__notifications-heading">
            <strong>{t('NOTIFICATIONS_TITLE')}</strong>
            <span>{t('NOTIFICATIONS_RECENT')}</span>
          </header>
          {activityQuery.isLoading && (
            <p className="floating-navigation__notifications-state">{t('NOTIFICATIONS_LOADING')}</p>
          )}
          {activityQuery.isError && (
            <p className="floating-navigation__notifications-state">{t('NOTIFICATIONS_LOAD_ERROR')}</p>
          )}
          {!activityQuery.isLoading && !activityQuery.isError && activities.length === 0 && (
            <p className="floating-navigation__notifications-state">{t('NOTIFICATIONS_EMPTY')}</p>
          )}
          {activities.map(activity => (
            <Link
              className="floating-navigation__notification-item"
              to={getActivityHref(activity)}
              key={activity.id}
              onClick={onClose}
            >
              <span>{renderActivity(activity)}</span>
              <time dateTime={new Date(activity.updatedAt).toISOString()}>
                {new Date(activity.updatedAt).toLocaleString()}
              </time>
            </Link>
          ))}
          <Link
            className="floating-navigation__notifications-all"
            to={ROUTES.home}
            onClick={onClose}
          >
            {t('NOTIFICATIONS_VIEW_FEED')}
          </Link>
        </section>
      )}
    </>
  )
}
