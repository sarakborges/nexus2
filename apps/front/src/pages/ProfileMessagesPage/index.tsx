import { Pagination, RequestState } from '@/Components'
import { AuthenticatedPageState } from '@/Components/Organisms/AuthenticatedPageState'
import { Tabs } from '@/DesignSystem'
import { PaginatedListControls } from '@/Components/Organisms/PaginatedListControls'
import { ProfileSidebar, SocialPageLayout } from '@/Components/Organisms/SocialPageLayout'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProfileMessageComposer } from '@/Components/Molecules'
import { ProfileMessageList } from '@/Components/Organisms'
import { useProfileMessagesPage } from './useProfileMessagesPage'


export function ProfileMessagesPage() {
  const { t } = useTranslations()
  const {
    requestedUrl,
    session,
    isAuthInitialized,
    page,
    pageSize,
    setPage,
    query,
    sort,
    setQuery,
    setSort,
    content,
    setContent,
    replyTo,
    handleCancelReply,
    messageTab,
    handleMessageTabChange,
    profileMessagesPageQuery,
    profile,
    viewerRelationship,
    typeCompatibility,
    isProfileOwner,
    totalItems,
    messageItems,
    handleDeleteMessage,
    handleFavoriteMessage,
    handleReplyMessage,
    isMessageActionPending,
    canSendMessage,
    canSubmitMessage,
    uploadEditorImage,
    isSendingMessage,
    hasSendMessageError,
    isInvalidMessageError,
    handleSubmit
  } = useProfileMessagesPage()

  if (!requestedUrl) return <NotFoundPage />
  if (!isAuthInitialized || profileMessagesPageQuery.isLoading)
    return <AuthenticatedPageState isLoading />
  if (profileMessagesPageQuery.isError)
    return (
      <AuthenticatedPageState
        isError
        onRetry={() => void profileMessagesPageQuery.refetch()}
      />
    )
  if (!profile) return <NotFoundPage />

  return (
    <SocialPageLayout
      sidebar={<ProfileSidebar profile={profile} active="messages" relationship={viewerRelationship} />}
    >
      <div className="social-page__content-stack">
        <RequestState isFetching={profileMessagesPageQuery.isFetching} />
        {!typeCompatibility.isChecking && !typeCompatibility.isCompatible && (
          <p className="profile-type-notice" role="alert">
            {t('PROFILE_TYPE_MISMATCH_NOTICE')}
          </p>))}
        
        <header className="account-card__header">
          <div>
            <h1 className="account-card__title">
              {t('PROFILE_MESSAGES_TITLE', { name: profile.name })}
            </h1>
            <p className="account-card__description">
              {t(
                isProfileOwner
                  ? 'PROFILE_MESSAGES_OWNER_DESCRIPTION'
                  : 'PROFILE_MESSAGES_VISITOR_DESCRIPTION'))}
              
            </p>
          </div>
        </header>
        <ProfileMessageComposer
          hasSession={Boolean(session)}
          isProfileOwner={isProfileOwner}
          canSendMessage={canSendMessage}
          content={content}
          onContentChange={setContent}
          canSubmitMessage={canSubmitMessage}
          isSendingMessage={isSendingMessage}
          hasSendMessageError={hasSendMessageError}
          isInvalidMessageError={isInvalidMessageError}
          onUploadImage={uploadEditorImage}
          onSubmit={handleSubmit}
          replyToName={replyTo?.name}
          onCancelReply={handleCancelReply}
        />
        {isProfileOwner && (
          <Tabs ariaLabel={t('PROFILE_MESSAGES_TABS_LABEL')} value={messageTab} onChange={handleMessageTabChange} options={[
            { value: 'all', label: t('PROFILE_MESSAGES_TAB_ALL') },
            { value: 'favorites', label: t('PROFILE_MESSAGES_TAB_FAVORITES') }
          ]} />
        )}
        {(totalItems > 0 && (
          <PaginatedListControls
            key={query}
            query={query}
            sort={sort}
            onQueryChange={setQuery}
            onSortChange={setSort}
          />))}
        
        <RequestState
          isLoading={profileMessagesPageQuery.isLoading}
          isFetching={profileMessagesPageQuery.isFetching}
          isError={profileMessagesPageQuery.isError}
          isEmpty={
            profileMessagesPageQuery.isSuccess &&
            totalItems === 0
          }
          emptyMessage={t('PROFILE_MESSAGES_EMPTY')}
          onRetry={() => void profileMessagesPageQuery.refetch()}
        >
          <ProfileMessageList items={messageItems} isActionPending={isMessageActionPending} onDelete={handleDeleteMessage} onFavorite={handleFavoriteMessage} onReply={handleReplyMessage} />
        </RequestState>
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setPage}
        />
      </div>
    </SocialPageLayout>
  )
}
