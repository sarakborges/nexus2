import { type FormEvent, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'
import { hasRichTextContent } from '@/Components/Molecules/RichTextEditor/richText.utils'
import { useTranslations } from '@/Hooks/Language'
import { uploadEditorImage } from '@/Services/Uploads'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { useCreateProfileMessageMutation } from '@/Hooks/ProfileMessage'
import {
  ProfileMessageError,
  deleteProfileMessage,
  getProfileMessagesPage,
  setProfileMessageFavorite
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
  const { page, pageSize, setPage, query, sort, setQuery, setSort } = useUrlPagination()
  const [content, setContent] = useState('')
  const [requestedMessageTab, setRequestedMessageTab] = useState<'all' | 'favorites'>('all')
  const [replyTo, setReplyTo] = useState<import('@nexus/common').Profile | null>(null)
  const queryClient = useQueryClient()

  const profileMessagesPageQuery = useQuery({
    queryKey: queryKeys.profileMessagesPage(
      requestedUrl,
      page,
      pageSize,
      session?.user.id ?? null,
      currentProfileId,
      query,
      sort,
      requestedMessageTab
    ),
    queryFn: () =>
      getProfileMessagesPage(requestedUrl, { page, pageSize, query, sort, messageTab: requestedMessageTab }),
    enabled: Boolean(requestedUrl && isAuthInitialized),
    staleTime: 30 * 1000
  })
  const pageData = profileMessagesPageQuery.data
  const profile = pageData?.profile
  const isProfileOwner = pageData?.isProfileOwner ?? false
  const viewerRelationship = pageData?.viewerRelationship ?? null
  const currentProfileType = pageData?.currentProfileType ?? null
  const isChecking = Boolean(currentProfileId && profileMessagesPageQuery.isLoading)
  const isCompatible = !currentProfileId || (profileMessagesPageQuery.isSuccess && currentProfileType === (profile?.type ?? 'social'))
  const typeCompatibility = {
    isChecking,
    isCompatible,
    canInteract: !session || (isCompatible && !isChecking)
  }
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
  const messageItems = useMemo<ProfileMessageViewModel[]>(() => messages.map(message => {
    const permissions = pageData?.messagePermissions[message.id]
    return {
      message,
      sender: sendersById.get(message.fromProfileId),
      canDelete: permissions?.canDelete ?? false,
      canFavorite: permissions?.canFavorite ?? false,
      canReply: permissions?.canReply ?? false
    }
  }), [messages, sendersById, pageData?.messagePermissions])
  const messageSenderProfileId = replyTo
    ? currentProfileId
    : currentProfileId ?? (isProfileOwner ? (profile?.id ?? null) : null)
  const messageTargetProfileId = replyTo?.id ?? profile?.id ?? null
  const canSendMessage = Boolean(
    profile && session && messageSenderProfileId && messageTargetProfileId && canInteract
  )
  const sendMessageMutation = useCreateProfileMessageMutation()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (
      !hasRichTextContent(content) ||
      content.length > 8000 ||
      !canSendMessage ||
      !profile ||
      !messageSenderProfileId
    ) return

    await sendMessageMutation.mutateAsync(
      {
        fromProfileId: messageSenderProfileId,
        toProfileId: messageTargetProfileId!,
        content
      },
      {
        onSuccess: () => {
          setContent('')
          setReplyTo(null)
          if (page !== 1) setPage(1)
          showToast(t('TOAST_MESSAGE_SENT'))
        },
        onError: () => showToast(t('TOAST_ACTION_FAILED'), 'error')
      }
    )
  }

  const invalidateMessagePages = async () => queryClient.invalidateQueries({
    queryKey: ['profile-messages-page', requestedUrl]
  })
  const deleteMessageMutation = useMutation({
    mutationFn: ({ messageId, actorProfileId }: { messageId: string; actorProfileId: string }) =>
      deleteProfileMessage(profile?.id ?? '', messageId, actorProfileId),
    onSuccess: invalidateMessagePages
  })
  const favoriteMessageMutation = useMutation({
    mutationFn: ({ messageId, isFavorite }: { messageId: string; isFavorite: boolean }) =>
      setProfileMessageFavorite(profile?.id ?? '', messageId, profile?.id ?? '', isFavorite),
    onSuccess: invalidateMessagePages
  })
  const handleDeleteMessage = (item: ProfileMessageViewModel) => {
    if (!profile || !item.canDelete) return
    const actorProfileId = isProfileOwner ? profile.id : item.message.fromProfileId
    deleteMessageMutation.mutate({ messageId: item.message.id, actorProfileId }, {
      onSuccess: () => showToast(t('PROFILE_MESSAGE_DELETED')),
      onError: () => showToast(t('TOAST_ACTION_FAILED'), 'error')
    })
  }
  const handleFavoriteMessage = (item: ProfileMessageViewModel) => {
    if (!profile || !item.canFavorite) return
    favoriteMessageMutation.mutate({ messageId: item.message.id, isFavorite: !item.message.isFavorite }, {
      onSuccess: () => showToast(t('PROFILE_MESSAGE_FAVORITE_UPDATED')),
      onError: () => showToast(t('TOAST_ACTION_FAILED'), 'error')
    })
  }
  const handleReplyMessage = (sender: import('@nexus/common').Profile) => {
    setContent('')
    setReplyTo(sender)
  }
  const handleCancelReply = () => setReplyTo(null)
  const handleMessageTabChange = (tab: 'all' | 'favorites') => {
    setRequestedMessageTab(tab)
    if (page !== 1) setPage(1)
  }

  return {
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
    messageTab: pageData?.messageTab ?? requestedMessageTab,
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
    isMessageActionPending: deleteMessageMutation.isPending || favoriteMessageMutation.isPending,
    canSendMessage,
    canSubmitMessage: hasRichTextContent(content) && content.length <= 8000,
    isSendingMessage: sendMessageMutation.isPending,
    hasSendMessageError: sendMessageMutation.isError,
    isInvalidMessageError:
      sendMessageMutation.error instanceof ProfileMessageError &&
      sendMessageMutation.error.code === 'INVALID_MESSAGE',
    handleSubmit,
    uploadEditorImage
  }
}
