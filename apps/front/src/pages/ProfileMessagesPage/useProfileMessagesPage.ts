import { useQuery } from '@tanstack/react-query'

import { type FormEvent, useMemo, useState } from 'react'
import { useParams } from 'react-router'

import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'


import { hasRichTextContent } from '@/Components/Molecules/RichTextEditor/richText.utils'
import { useTranslations } from '@/Hooks/Language'
import { uploadEditorImage } from '@/Services/Uploads'
import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { useProfileByUrl, useProfilesByIds } from '@/Hooks/Profile'
import { useCreateProfileMessageMutation } from '@/Hooks/ProfileMessage'
import {
  ProfileMessageError,
  getProfileMessages
} from '@/Services/ProfileMessage'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'
import type { UseProfileMessagesPageResult } from './useProfileMessagesPage.types'

export function useProfileMessagesPage(): UseProfileMessagesPageResult {
  const { t } = useTranslations()
  const { url } = useParams<{ url: string }>()
  const requestedUrl = normalizeEntityUrl(url)
  const session = useAuthStore((state) => state.session)
  const currentProfileId = session?.user.currentProfile ?? null
  const showToast = useToastStore((state) => state.showToast)
  const { page, pageSize, setPage } = useUrlPagination()
  const [content, setContent] = useState('')
  const profileQuery = useProfileByUrl({ url: requestedUrl })
  const profile = profileQuery.data
  const typeCompatibility = useProfileTypeCompatibility(
    profile?.type ?? 'social'
  )
  const canInteract = typeCompatibility.canInteract
  const isProfileOwner = Boolean(
    profile && session?.user.profiles.includes(profile.id)
  )
  const messagesQuery = useQuery({
    queryKey: queryKeys.profileMessages(
      profile?.id ?? '',
      session?.user.id ?? null,
      page,
      pageSize
    ),
    queryFn: () => getProfileMessages(profile!.id, { page, pageSize }),
    enabled: Boolean(profile?.id)
  })
  const totalItems = messagesQuery.data?.totalItems ?? 0
  const senderIds = useMemo(
    () =>
      [
        ...new Set(
          (messagesQuery.data?.items ?? []).map(
            (message) => message.fromProfileId
          )
        )
      ].sort(),
    [messagesQuery.data?.items]
  )
  const {
    profilesQuery: senderProfilesQuery,
    profilesById: sendersById
  } = useProfilesByIds(senderIds)
  const messageItems = useMemo(
    () =>
      (messagesQuery.data?.items ?? []).map((message) => ({
        message,
        sender: sendersById.get(message.fromProfileId)
      })),
    [messagesQuery.data?.items, sendersById]
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
    )
      return

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
    page,
    pageSize,
    setPage,
    content,
    setContent,
    profileQuery,
    profile,
    typeCompatibility,
    isProfileOwner,
    messagesQuery,
    totalItems,
    senderProfilesQuery,
    messageItems,
    canSendMessage,
    canSubmitMessage: hasRichTextContent(content),
    isSendingMessage: sendMessageMutation.isPending,
    hasSendMessageError: sendMessageMutation.isError,
    isInvalidMessageError: sendMessageMutation.error instanceof ProfileMessageError && sendMessageMutation.error.code === 'INVALID_MESSAGE',
    handleSubmit,
    uploadEditorImage
  }
}
