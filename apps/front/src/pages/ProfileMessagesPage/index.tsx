import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { Pagination, RequestState } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { Button, Label } from '@/DesignSystem'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { useTranslations } from '@/Hooks/Language'
import { getProfilesByIds, getProfileByUrl } from '@/Services/Profile'
import { createProfileMessage, ProfileMessageError } from '@/Services/ProfileMessage'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { NotFoundPage } from '@/pages/NotFoundPage'
import '../AuthenticatedPage.style.scss'

export function ProfileMessagesPage() {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const queryClient = useQueryClient()
  const requestedUrl = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const session = useAuthStore(state => state.session)
  const currentProfileId = session?.user.currentProfile ?? null
  const { page, pageSize, setPage } = useUrlPagination()
  const [content, setContent] = useState('')
  const profileQuery = useQuery({
    queryKey: queryKeys.profiles.byUrl(requestedUrl),
    queryFn: () => getProfileByUrl(requestedUrl),
    enabled: Boolean(requestedUrl)
  })
  const profile = profileQuery.data
  const isProfileOwner = Boolean(profile && session?.user.profiles.includes(profile.id))
  const viewerProfileId = isProfileOwner ? profile?.id ?? null : currentProfileId
  const messagesQuery = useQuery({
    queryKey: queryKeys.profileMessages(profile?.id ?? '', session?.user.id ?? null, page, pageSize),
    queryFn: () => getProfileMessages(profile!.id, { page, pageSize }),
    enabled: Boolean(profile?.id)
  })
  const messages = messagesQuery.data?.items ?? []
  const totalItems = messagesQuery.data?.totalItems ?? 0
  const senderIds = useMemo(() => [...new Set(messages.map(message => message.fromProfileId))].sort(), [messages])
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
  const canSendMessage = Boolean(profile && session && messageSenderProfileId)
  const sendMessageMutation = useMutation({
    mutationFn: () => createProfileMessage(messageSenderProfileId!, profile!.id, content),
    onSuccess: async () => {
      setContent('')
      if (page !== 1) setPage(1)
      await queryClient.invalidateQueries({ queryKey: ['profile-messages', profile?.id] })
    }
  })

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!content.trim() || !canSendMessage) return
    await sendMessageMutation.mutateAsync()
  }

  if (!requestedUrl) return <NotFoundPage />
  if (profileQuery.isLoading) return <main className="account-page"><section className="account-card"><RequestState isLoading /></section></main>
  if (profileQuery.isError) return <main className="account-page"><section className="account-card"><RequestState isError onRetry={() => void profileQuery.refetch()} /></section></main>
  if (!profile) return <NotFoundPage />

  return (
    <main className="account-page"><section className="account-card">
      <header className="account-card__header">
        <div><h1 className="account-card__title">{t('PROFILE_MESSAGES_TITLE', { name: profile.name })}</h1><p className="account-card__description">{t(isProfileOwner ? 'PROFILE_MESSAGES_OWNER_DESCRIPTION' : 'PROFILE_MESSAGES_VISITOR_DESCRIPTION')}</p></div>
        <Link className="account-card__link" to={`${ROUTES.profile}/${profile.url}`}>{t('COMMUNITY_BACK_TO_PAGE')}</Link>
      </header>
      {canSendMessage ? (
        <form className="profile-message-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <Label htmlFor="profile-message-content">{t('PROFILE_MESSAGES_COMPOSE_LABEL')}</Label>
            <textarea className="input auth-form__textarea" id="profile-message-content" rows={4} maxLength={4000} value={content} onChange={event => setContent(event.target.value)} required />
            <p className="account-card__description">{t('PROFILE_MESSAGES_MAX_LENGTH')}</p>
          </div>
          {sendMessageMutation.isError && (
            <p className="auth-card__error" role="alert">
              {t(sendMessageMutation.error instanceof ProfileMessageError && sendMessageMutation.error.code === 'INVALID_MESSAGE' ? 'PROFILE_MESSAGES_ERROR_INVALID' : 'PROFILE_MESSAGES_ERROR_STORAGE')}
            </p>
          )}
          <Button type="submit" disabled={!content.trim() || sendMessageMutation.isPending}>
            {sendMessageMutation.isPending ? t('AUTH_SUBMITTING') : t('PROFILE_MESSAGES_SEND')}
          </Button>
        </form>
      ) : !isProfileOwner && (
        <p className="account-card__description">{session ? t('PROFILE_MESSAGES_NEED_PROFILE') : <>{t('PROFILE_MESSAGES_SIGN_IN')} {' '}<Link to={ROUTES.signIn}>{t('AUTH_SIGN_IN_LINK')}</Link></>}</p>
      )}
      <RequestState
        isLoading={messagesQuery.isLoading}
        isError={messagesQuery.isError}
        isEmpty={messagesQuery.isSuccess && totalItems === 0}
        emptyMessage={t('PROFILE_MESSAGES_EMPTY')}
        onRetry={() => void messagesQuery.refetch()}
      >
        <RequestState
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
                    {sender ? <Link className="account-card__link" to={`${ROUTES.profile}/${sender.url}`}>{sender.name}</Link> : <span>{t('PROFILE_MESSAGES_UNKNOWN_SENDER')}</span>}
                    <time className="profile-message__date" dateTime={new Date(message.createdAt).toISOString()}>{new Date(message.createdAt).toLocaleString()}</time>
                  </header>
                  <p className="profile-message__content">{message.content}</p>
                </article>
              )
            })}
          </div>
        </RequestState>
      </RequestState>
      <Pagination page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} />
    </section></main>
  )
}
