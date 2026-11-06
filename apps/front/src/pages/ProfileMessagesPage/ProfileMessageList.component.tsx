import { Link } from 'react-router'

import { AccountIdentityLink } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import type { ProfileMessageListProps } from './ProfileMessageList.types'

export function ProfileMessageList({ items }: ProfileMessageListProps) {
  const { t } = useTranslations()

  return (
    <div className="profile-message-list">
      {items.map(({ message, sender }) => (
        <article className="profile-message" key={message.id}>
          <header className="profile-message__header">
            {sender ? (
              <AccountIdentityLink
                to={ROUTES.profile + '/' + sender.url}
                name={sender.name}
                picture={sender.picture}
                title={sender.name}
                ariaLabel={sender.name}
                className="profile-message__sender"
                avatarClassName="profile-message__avatar"
                copyClassName="profile-message__sender-copy"
                nameClassName="account-card__link"
              >
                <time
                  className="profile-message__date"
                  dateTime={new Date(message.createdAt).toISOString()}
                >
                  {new Date(message.createdAt).toLocaleString()}
                </time>
              </AccountIdentityLink>
            ) : (
              <span>{t('PROFILE_MESSAGES_UNKNOWN_SENDER')}</span>
            )}
          </header>
          <div
            className="profile-message__content rich-text-content"
            dangerouslySetInnerHTML={{ __html: message.content }}
          />
        </article>
      ))}
    </div>
  )
}
