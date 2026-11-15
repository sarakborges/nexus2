import { Link } from 'react-router'
import { FiBell } from 'react-icons/fi'

import { NotificationActivityEntry } from '@/Components/Molecules/NotificationActivityEntry'
import { Button } from '@/DesignSystem'
import type { NotificationsMenuProps } from './NotificationsMenu.types'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { useAuthStore } from '@/Stores/Auth.store'

import './NotificationsMenu.style.scss'

export function NotificationsMenu({
  isOpen,
  onToggle,
  onClose
}: NotificationsMenuProps) {
  const { t } = useTranslations()
  const activities = useAuthStore(state => state.session?.activities.slice(0, 8) ?? [])

  return (
    <>
      <Button
        variation="transparent"
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
      </Button>

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
          {activities.length === 0 && (
            <p className="floating-navigation__notifications-state">
              {t('NOTIFICATIONS_EMPTY')}
            </p>
          )}
          {activities.map(activity => (
            <NotificationActivityEntry
              key={activity.id}
              activity={activity}
              onClick={onClose}
            />
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
