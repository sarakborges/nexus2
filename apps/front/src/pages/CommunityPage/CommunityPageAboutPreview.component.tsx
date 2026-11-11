import { Link } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import { Button, RichTextContent } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import type { CommunityPageAboutPreviewProps } from './CommunityPageAboutPreview.types'

export function CommunityPageAboutPreview({
  community,
  canViewMembers,
  canEditCommunity,
  pendingRequestCount,
  onEdit
}: CommunityPageAboutPreviewProps) {
  const { t } = useTranslations()

  return (
    <article className="social-panel social-panel--about">
      <header className="social-panel__header">
        <div>
          <h2 className="social-panel__title">
            {t('COMMUNITY_ABOUT_LABEL')}
          </h2>
        </div>
        {canEditCommunity && (
          <Button type="button" variation="primary" onClick={onEdit}>
            {t('COMMUNITY_EDIT')}
          </Button>
        )}
      </header>
      {pendingRequestCount > 0 && (
        <Link
          className="community-pending-notice"
          to={ROUTES.community + '/' + community.url + '/members'}
        >
          {t('COMMUNITY_PENDING_ABOUT_NOTICE', {
            count: pendingRequestCount
          })}
        </Link>
      )}
      {!canViewMembers ? (
        <p className="social-panel__body">
          {t('COMMUNITY_PRIVATE_RESTRICTED')}
        </p>
      ) : community.about ? (
        <RichTextContent className="social-panel__body" html={community.about} />
      ) : (
        <p className="social-panel__body">{t('COMMUNITY_ABOUT_EMPTY')}</p>
      )}
    </article>
  )
}
