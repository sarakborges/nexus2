import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import type { CommunityForumTopicModerationActionsProps } from './CommunityForumTopicModerationActions.types'

export function CommunityForumTopicModerationActions({
  canDeleteTopic,
  isStaff,
  isPinned,
  isLocked,
  isUpdatingTopic,
  isDeletingTopic,
  onTogglePinned,
  onToggleLocked,
  onDeleteTopic
}: CommunityForumTopicModerationActionsProps) {
  const { t } = useTranslations()

  if (!canDeleteTopic) return null

  return (
    <div className="community-forum__actions">
      {isStaff && (
        <>
          <Button
            variation="secondary"
            disabled={isUpdatingTopic}
            onClick={onTogglePinned}
          >
            {t(isPinned ? 'FORUM_UNPIN' : 'FORUM_PIN')}
          </Button>
          <Button
            variation="secondary"
            disabled={isUpdatingTopic}
            onClick={onToggleLocked}
          >
            {t(isLocked ? 'FORUM_UNLOCK' : 'FORUM_LOCK')}
          </Button>
        </>
      )}
      <Button
        variation="cancel"
        disabled={isDeletingTopic}
        onClick={onDeleteTopic}
      >
        {t('FORUM_DELETE')}
      </Button>
    </div>
  )
}
