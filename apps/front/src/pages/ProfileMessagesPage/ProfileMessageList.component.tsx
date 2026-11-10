import { AccountIdentityLink } from '@/Components'
import { Button, RichTextContent } from '@/DesignSystem'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { FiCornerUpLeft, FiStar, FiTrash2 } from 'react-icons/fi'
import type { ProfileMessageListProps } from './ProfileMessageList.types'

export function ProfileMessageList({ items, isActionPending, onDelete, onFavorite, onReply }: ProfileMessageListProps) {
  const { t } = useTranslations()
  return (
    <div className="profile-message-list">
      {items.map(item => {
        const { message, sender } = item
        return (
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
                  <time className="profile-message__date" dateTime={new Date(message.createdAt).toISOString()}>
                    {new Date(message.createdAt).toLocaleString()}
                  </time>
                </AccountIdentityLink>
              ) : <span>{t('PROFILE_MESSAGES_UNKNOWN_SENDER')}</span>}
              {message.isFavorite && (
                <span className="profile-message__favorite-indicator" role="img" aria-label={t('PROFILE_MESSAGE_FAVORITED')} title={t('PROFILE_MESSAGE_FAVORITED')}>
                  <FiStar aria-hidden="true" />
                </span>
              )}
            </header>
            <RichTextContent className="profile-message__content" html={message.content} />
            <footer className="profile-message__actions">
              {item.canReply && sender && (
                <Button type="button" variation="transparent" className="profile-message__action" disabled={isActionPending} onClick={() => onReply(sender)}>
                  <FiCornerUpLeft aria-hidden="true" />
                  <span>{t('PROFILE_MESSAGE_REPLY')}</span>
                </Button>
              )}
              {item.canFavorite && (
                <Button type="button" variation="transparent" className="profile-message__action" disabled={isActionPending} aria-pressed={Boolean(message.isFavorite)} onClick={() => onFavorite(item)}>
                  <FiStar aria-hidden="true" />
                  <span>{t(message.isFavorite ? 'PROFILE_MESSAGE_UNFAVORITE' : 'PROFILE_MESSAGE_FAVORITE')}</span>
                </Button>
              )}
              {item.canDelete && (
                <Button type="button" variation="transparent" className="profile-message__action profile-message__action--danger" disabled={isActionPending} onClick={() => onDelete(item)}>
                  <FiTrash2 aria-hidden="true" />
                  <span>{t('PROFILE_MESSAGE_DELETE')}</span>
                </Button>
              )}
            </footer>
          </article>
        )
      })}
    </div>
  )
}
