import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { type FormEvent, useMemo, useState } from 'react'
import { useParams } from 'react-router'

import { hasRichTextContent } from '@/Components/Molecules/RichTextEditor/richText.utils'
import { useTranslations } from '@/Hooks/Language'
import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { getProfileByUrl, getProfilesByIds } from '@/Services/Profile'
import {
  createProfileMessage,
  getProfileMessages
} from '@/Services/ProfileMessage'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'

export function useProfileMessagesPage() {
  const { url } = useParams<{ url: string }>()
  const queryClient = useQueryClient()
  const requestedUrl = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const session = useAuthStore((state) => state.session)
  const currentProfileId = session?.user.currentProfile ?? null
  const showToast = useToastStore((state) => state.showToast)
  const { page, pageSize, setPage } = useUrlPagination()
  const [content, setContent] = useState('')
  const profileQuery = useQuery({
    queryKey: queryKeys.profiles.byUrl(requestedUrl),
    queryFn: () => getProfileByUrl(requestedUrl),
    enabled: Boolean(requestedUrl)
  })
  const profile = profileQuery.data
  const typeCompatibility = useProfileTypeCompatibility(
    profile?.type ?? 'social'
  )
  const canInteract =
    typeCompatibility.isCompatible && !typeCompatibility.isChecking
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
  const messages = messagesQuery.data?.items ?? []
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
  const senderProfilesQuery = useQuery({
    queryKey: queryKeys.profiles.byIds(senderIds),
    queryFn: () => getProfilesByIds(senderIds),
    enabled: senderIds.length > 0
  })
  const sendersById = useMemo(
    () =>
      new Map(
        (senderProfilesQuery.data ?? []).map(
          (sender) => [sender.id, sender] as const
        )
      ),
    [senderProfilesQuery.data]
  )
  const messageSenderProfileId =
    currentProfileId ?? (isProfileOwner ? (profile?.id ?? null) : null)
  const canSendMessage = Boolean(
    profile && session && messageSenderProfileId && canInteract
  )
  const sendMessageMutation = useMutation({
    mutationFn: () =>
      createProfileMessage(messageSenderProfileId!, profile!.id, content),
    onSuccess: async () => {
      setContent('')
      if (page !== 1) setPage(1)
      showToast(t('TOAST_MESSAGE_SENT'))
      await queryClient.invalidateQueries({
        queryKey: ['profile-messages', profile?.id]
      })
    },
    onError: () => showToast(t('TOAST_ACTION_FAILED'), 'error')
  })

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!hasRichTextContent(content) || !canSendMessage) return
    await sendMessageMutation.mutateAsync()
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
    messages,
    totalItems,
    senderProfilesQuery,
    sendersById,
    canSendMessage,
    canSubmitMessage: hasRichTextContent(content),
    sendMessageMutation,
    handleSubmit
  }
}
