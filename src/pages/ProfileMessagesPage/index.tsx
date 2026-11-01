import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'

import { Pagination } from '@/Components'
import { DEFAULT_PAGE_SIZE } from '@/Constants/pagination'
import { ROUTES } from '@/Constants/routes'
import { Button, Label } from '@/DesignSystem'
import { getPageItems } from '@/Helpers/Math/pagination.helper'
import { useTranslations } from '@/Hooks/Language'
import type { Profile } from '@/Models/Profile.model'
import { getProfilesByIds } from '@/Services/Profile'
import { ProfileMessageError } from '@/Services/ProfileMessage'
import { useAuthStore } from '@/Stores/Auth.store'
import { useProfileMessageStore } from '@/Stores/ProfileMessage.store'
import { useProfileStore } from '@/Stores/Profile.store'
import { NotFoundPage } from '@/pages/NotFoundPage'

import '../AuthenticatedPage.style.scss'

export function ProfileMessagesPage() {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const requestedUrl = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const profile = useProfileStore((state) => state.profile)
  const loadedUrl = useProfileStore((state) => state.loadedUrl)
  const loadProfileByUrl = useProfileStore((state) => state.loadProfileByUrl)
  const clearProfile = useProfileStore((state) => state.clearProfile)
  const session = useAuthStore((state) => state.session)
  const currentProfileId = session?.user.currentProfile ?? null
  const isProfileOwner = Boolean(
    profile && session?.user.profiles.includes(profile.id)
  )
  const viewerProfileId = isProfileOwner
    ? profile?.id ?? null
    : currentProfileId
  const messages = useProfileMessageStore((state) => state.messages)
  const messagesProfileId = useProfileMessageStore((state) => state.profileId)
  const messagesViewerId = useProfileMessageStore(
    (state) => state.viewerProfileId
  )
  const loadMessages = useProfileMessageStore((state) => state.loadMessages)
  const sendMessage = useProfileMessageStore((state) => state.sendMessage)
  const clearMessages = useProfileMessageStore((state) => state.clearMessages)
  const [content, setContent] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (requestedUrl) {
      loadProfileByUrl(requestedUrl)
    } else {
      clearProfile()
    }
  }, [requestedUrl, loadProfileByUrl, clearProfile])

  useEffect(() => {
    if (profile) {
      loadMessages(profile.id, viewerProfileId)
      setPage(1)
    } else {
      clearMessages()
    }
  }, [profile, viewerProfileId, loadMessages, clearMessages])

  const canSendMessage = Boolean(
    profile &&
      session &&
      currentProfileId &&
      !session.user.profiles.includes(profile.id)
  )
  const senderProfiles = useMemo(
    () =>
      getProfilesByIds([
        ...new Set(messages.map((message) => message.fromProfileId))
      ]),
    [messages]
  )
  const sendersById = new Map(
    senderProfiles.map((sender) => [sender.id, sender] as const)
  )
  const pageMessages = getPageItems(messages, page, DEFAULT_PAGE_SIZE)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')

    if (!profile || !currentProfileId || !canSendMessage) {
      return
    }

    try {
      sendMessage(currentProfileId, profile.id, content)
      setContent('')
      setPage(1)
    } catch (error) {
      const code = error instanceof ProfileMessageError ? error.code : null
      setErrorMessage(
        t(
          code === 'INVALID_MESSAGE'
            ? 'PROFILE_MESSAGES_ERROR_INVALID'
            : 'PROFILE_MESSAGES_ERROR_STORAGE'
        )
      )
    }
  }

  if (loadedUrl !== requestedUrl) {
    return null
  }

  if (!profile) {
    return <NotFoundPage />
  }

  if (messagesProfileId !== profile.id || messagesViewerId !== viewerProfileId) {
    return null
  }

  return (
    <main className="account-page">
      <section className="account-card">
        <header className="account-card__header">
          <div>
            <h1 className="account-card__title">
              {t('PROFILE_MESSAGES_TITLE', { name: profile.name })}
            </h1>
            <p className="account-card__description">
              {t(
                isProfileOwner
                  ? 'PROFILE_MESSAGES_OWNER_DESCRIPTION'
                  : 'PROFILE_MESSAGES_VISITOR_DESCRIPTION'
              )}
            </p>
          </div>
          <Link
            className="account-card__link"
            to={`${ROUTES.profile}/${profile.url}`}
          >
            {t('COMMUNITY_BACK_TO_PAGE')}
          </Link>
        </header>

        {canSendMessage ? (
          <form className="profile-message-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <Label htmlFor="profile-message-content">
                {t('PROFILE_MESSAGES_COMPOSE_LABEL')}
              </Label>
              <textarea
                className="input auth-form__textarea"
                id="profile-message-content"
                rows={4}
                maxLength={4000}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                required
              />
              <p className="account-card__description">
                {t('PROFILE_MESSAGES_MAX_LENGTH')}
              </p>
            </div>
            {errorMessage && (
              <p className="auth-card__error" role="alert">
                {errorMessage}
              </p>
            )}
            <Button type="submit" disabled={!content.trim()}>
              {t('PROFILE_MESSAGES_SEND')}
            </Button>
          </form>
        ) : (
          !isProfileOwner && (
            <p className="account-card__description">
              {session
                ? t('PROFILE_MESSAGES_NEED_PROFILE')
                : t('PROFILE_MESSAGES_SIGN_IN')}
              {!session && (
                <>
                  {' '}
                  <Link to={ROUTES.signIn}>{t('AUTH_SIGN_IN_LINK')}</Link>
                </>
              )}
            </p>
          )
        )}

        {messages.length === 0 ? (
          <p className="account-card__description">
            {t('PROFILE_MESSAGES_EMPTY')}
          </p>
        ) : (
          <div className="profile-message-list">
            {pageMessages.map((message) => {
              const sender = sendersById.get(message.fromProfileId)

              return (
                <article className="profile-message" key={message.id}>
                  <header className="profile-message__header">
                    {sender ? (
                      <Link
                        className="account-card__link"
                        to={`${ROUTES.profile}/${sender.url}`}
                      >
                        {sender.name}
                      </Link>
                    ) : (
                      <span>{t('PROFILE_MESSAGES_UNKNOWN_SENDER')}</span>
                    )}
                    <time
                      className="profile-message__date"
                      dateTime={new Date(message.createdAt).toISOString()}
                    >
                      {new Date(message.createdAt).toLocaleString()}
                    </time>
                  </header>
                  <p className="profile-message__content">{message.content}</p>
                </article>
              )
            })}
          </div>
        )}

        <Pagination
          page={page}
          totalItems={messages.length}
          onPageChange={setPage}
        />
      </section>
    </main>
  )
}
