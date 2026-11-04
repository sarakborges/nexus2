import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { AccountIdentityLink, Pagination, RequestState, RichTextEditor } from '@/Components'
import { ProfileSidebar, SocialPageLayout } from '@/Components/Organisms/SocialPageLayout'
import { ROUTES } from '@/Constants/routes'
import { Button, Label } from '@/DesignSystem'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { useTranslations } from '@/Hooks/Language'
import { getProfilesByIds, getProfileByUrl } from '@/Services/Profile'
import { createProfileMessage, getProfileMessages, ProfileMessageError } from '@/Services/ProfileMessage'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'
import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { uploadFile } from '@/Services/Uploads'
import { hasRichTextContent } from '@/Components/Molecules/RichTextEditor/richText.utils'
import { NotFoundPage } from '@/pages/NotFoundPage'
import '../AuthenticatedPage.style.scss'


export function ProfileMessagesPage() {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const queryClient = useQueryClient()
  const requestedUrl = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const session = useAuthStore(state => state.session)
  const currentProfileId = session?.user.currentProfile ?? null
  const showToast = useToastStore(state => state.showToast)
  const { page, pageSize, setPage } = useUrlPagination()
  const [content, setContent] = useState('')
  const profileQuery = useQuery({
    queryKey: queryKeys.profiles.byUrl(requestedUrl),
    queryFn: () => getProfileByUrl(requestedUrl),
    enabled: Boolean(requestedUrl)
  })
  const profile = profileQuery.data
  const typeCompatibility = useProfileTypeCompatibility(profile?.type ?? 'social')
  const canInteract = typeCompatibility.isCompatible && !typeCompatibility.isChecking
  const isProfileOwner = Boolean(profile && session?.user.profiles.includes(profile.id))
  const messagesQuery = useQuery({
    queryKey: queryKeys.profileMessages(profile?.id ?? '', session?.user.id ?? null, page, pageSize),
    queryFn: () => getProfileMessages(profile!.id, { page, pageSize }),
    enabled: Boolean(profile?.id)
  })
  const messages = messagesQuery.data?.items ?? []
  const totalItems = messagesQuery.data?.totalItems ?? 0
  const senderIds = useMemo(() => [...new Set((messagesQuery.data?.items ?? []).map(message => message.fromProfileId))].sort(), [messagesQuery.data?.items])
  const senderProfilesQuery = useQuery({
    queryKey: queryKeys.profiles.byIds(senderIds),
    queryFn: () => getProfilesByIds(senderIds),
    enabled: senderIds.length > 0
  })
  const sendersById = useMemo(
    () => new Map((senderProfilesQuery.data ?? []).map(sender => [sender.id, sender] as const)),
    [senderProfilesQuery.data]
  )
  const messageSenderProfileId = currentProfileId ?? (isProfileOwner ? profile?.id ?? null : null)
  const canSendMessage = Boolean(profile && session && messageSenderProfileId && canInteract)
  const sendMessageMutation = useMutation({
    mutationFn: () => createProfileMessage(messageSenderProfileId!, profile!.id, content),
    onSuccess: async () => {
      setContent('')
      if (page !== 1) setPage(1)
      showToast(t('TOAST_MESSAGE_SENT'))
      await queryClient.invalidateQueries({ queryKey: ['profile-messages', profile?.id] })
    },
    onError: () => showToast(t('TOAST_ACTION_FAILED'), 'error')
  })

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!hasRichTextContent(content) || !canSendMessage) return
    await sendMessageMutation.mutateAsync()
  }

  if (!requestedUrl) return <NotFoundPage />
  if (profileQuery.isLoading) return <main className="account-page"><section className="account-card"><RequestState isLoading /></section></main>
  if (profileQuery.isError) return <main className="account-page"><section className="account-card"><RequestState isError onRetry={() => void profileQuery.refetch()} /></section></main>
  if (!profile) return <NotFoundPage />

  return (
    <SocialPageLayout sidebar={<ProfileSidebar profile={profile} active="messages" />}><div className="social-page__content-stack">
      <RequestState isFetching={profileQuery.isFetching} />
      {!typeCompatibility.isChecking && !typeCompatibility.isCompatible && <p className="profile-type-notice" role="alert">{t('PROFILE_TYPE_MISMATCH_NOTICE')}</p>}
      <header className="account-card__header">
        <div><h1 className="account-card__title">{t('PROFILE_MESSAGES_TITLE', { name: profile.name })}</h1><p className="account-card__description">{t(isProfileOwner ? 'PROFILE_MESSAGES_OWNER_DESCRIPTION' : 'PROFILE_MESSAGES_VISITOR_DESCRIPTION')}</p></div>
      </header>
      {canSendMessage ? (
        <form className="profile-message-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <Label id="profile-message-content-label" htmlFor="profile-message-content">{t('PROFILE_MESSAGES_COMPOSE_LABEL')}</Label>
            <RichTextEditor
              id="profile-message-content"
              value={content}
              onChange={setContent}
              maxTextLength={4000}
              imageButtonLabel={t('RICH_TEXT_INSERT_IMAGE')}
              imageUploadErrorLabel={t('RICH_TEXT_IMAGE_UPLOAD_FAILED')}
              onUploadImage={file => uploadFile(file, 'editor-image').then(result => result.url)}
              placeholder={t('RICH_TEXT_PLACEHOLDER')}
            />
            <p className="account-card__description">{t('PROFILE_MESSAGES_MAX_LENGTH')}</p>
          </div>
          {sendMessageMutation.isError && (
            <p className="auth-card__error" role="alert">
              {t(sendMessageMutation.error instanceof ProfileMessageError && sendMessageMutation.error.code === 'INVALID_MESSAGE' ? 'PROFILE_MESSAGES_ERROR_INVALID' : 'PROFILE_MESSAGES_ERROR_STORAGE')}
            </p>
          )}
          <Button type="submit" disabled={!hasRichTextContent(content) || sendMessageMutation.isPending}>
            {sendMessageMutation.isPending ? t('AUTH_SUBMITTING') : t('PROFILE_MESSAGES_SEND')}
          </Button>
        </form>
      ) : !isProfileOwner && (
        <p className="account-card__description">{session ? t('PROFILE_MESSAGES_NEED_PROFILE') : <>{t('PROFILE_MESSAGES_SIGN_IN')} {' '}<Link to={ROUTES.signIn}>{t('AUTH_SIGN_IN_LINK')}</Link></>}</p>
      )}
      <RequestState
        isLoading={messagesQuery.isLoading}
        isFetching={messagesQuery.isFetching}
        isError={messagesQuery.isError}
        isEmpty={messagesQuery.isSuccess && totalItems === 0}
        emptyMessage={t('PROFILE_MESSAGES_EMPTY')}
        onRetry={() => void messagesQuery.refetch()}
      >
        <RequestState
          isLoading={senderProfilesQuery.isLoading}
          isFetching={senderProfilesQuery.isFetching}
          isError={senderProfilesQuery.isError}
          errorMessage={t('PROFILE_MESSAGES_SENDERS_ERROR')}
          onRetry={() => void senderProfilesQuery.refetch()}
        >
          <div className="profile-message-list">
            {messages.map(message => {
              const sender = sendersById.get(message.fromProfileId)
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
                    ) : (
                      <span>{t('PROFILE_MESSAGES_UNKNOWN_SENDER')}</span>
                    )}
                  </header>
                  <div className="profile-message__content rich-text-content" dangerouslySetInnerHTML={{ __html: message.content }} />
                </article>
              )
            })}
          </div>
        </RequestState>
      </RequestState>
      <Pagination page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} />
    </div></SocialPageLayout>
  )
}
