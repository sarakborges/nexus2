import { type FormEvent, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'
import { hasRichTextContent } from '@/Components/Molecules/RichTextEditor/richText.utils'
import { useTranslations } from '@/Hooks/Language'
import { uploadEditorImage } from '@/Services/Uploads'
import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { useCreateProfileMessageMutation } from '@/Hooks/ProfileMessage'
import {
  ProfileMessageError,
  getProfileMessagesPage
} from '@/Services/ProfileMessage'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'
import type { ProfileMessageViewModel } from './ProfileMessageList.types'
import type { UseProfileMessagesPageResult } from './useProfileMessagesPage.types'

export function useProfileMessagesPage(): UseProfileMessagesPageResult {
  const { t } = useTranslations()
  const { url } = useParams<{ url: string }>()
  const requestedUrl = normalizeEntityUrl(url)
  const session = useAuthStore((state) => state.session)
  const isAuthInitialized = useAuthStore((state) => state.isInitialized)
  const currentProfileId = session?.user.currentProfile ?? null
  const showToast = useToastStore((state) => state.showToast)
  const { page, pageSize, setPage } = useUrlPagination()
  const [content, setContent] = useState('')

  const profileMessagesPageQuery = useQuery({
    queryKey: queryKeys.profileMessagesPage(
      requestedUrl,
      page,
      pageSize,
      session?.user.id ?? null,
      currentProfileId
    ),
    queryFn: () =>
      getProfileMessagesPage(requestedUrl, { page, pageSize }),
    enabled: Boolean(requestedUrl && isAuthInitialized),
    staleTime: 30 * 1000
  })
  const pageData = profileMessagesPageQuery.data
  const profile = pageData?.profile
  const isProfileOwner = pageData?.isProfileOwner ?? false
  const viewerRelationship = pageData?.viewerRelationship ?? null
  const typeCompatibility = useProfileTypeCompatibility(
    profile?.type ?? 'social'
  )
  const canInteract = typeCompatibility.canInteract
  const messages = pageData?.messages.items ?? []
  const totalItems = pageData?.messages.totalItems ?? 0
  const sendersById = useMemo(
    () =>
      new Map(
        (pageData?.senders ?? []).map(
          (sender) => [sender.id, sender] as const
        )
      ),
    [pageData?.senders]
  )
  const messageItems = useMemo<ProfileMessageViewModel[]>(
    () =>
      messages.map((message) => ({
        message,
        sender: sendersById.get(message.fromProfileId)
      })),
    [messages, sendersById]
  )
  const messageSenderProfileId =
    currentProfileId ?? (isProfileOwner ? (profile?.id ?? null) : null)
  const canSendMessage = Boolean(
    profile && session && messageSenderProfileId && canInteract
  )
  const sendMessageMutation = useCreateProfileMessageMutation()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (
      !hasRichTextContent(content) ||
      !canSendMessage ||
      !profile ||
      !messageSenderProfileId
    ) return

    await sendMessageMutation.mutateAsync(
      {
        fromProfileId: messageSenderProfileId,
        toProfileId: profile.id,
        content
      },
      {
        onSuccess: () => {
          setContent('')
          if (page !== 1) setPage(1)
          showToast(t('TOAST_MESSAGE_SENT'))
        },
        onError: () => showToast(t('TOAST_ACTION_FAILED'), 'error')
      }
    )
  }

  return {
    requestedUrl,
    session,
    isAuthInitialized,
    page,
    pageSize,
    setPage,
    content,
    setContent,
    profileMessagesPageQuery,
    profile,
    viewerRelationship,
    typeCompatibility,
    isProfileOwner,
    totalItems,
    messageItems,
    canSendMessage,
    canSubmitMessage: hasRichTextContent(content),
    isSendingMessage: sendMessageMutation.isPending,
    hasSendMessageError: sendMessageMutation.isError,
    isInvalidMessageError:
      sendMessageMutation.error instanceof ProfileMessageError &&
      sendMessageMutation.error.code === 'INVALID_MESSAGE',
    handleSubmit,
    uploadEditorImage
  }
}
