import type {
  AuthSession,
  PaginatedResult,
  Profile,
  ProfileMessage
} from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'
import type { Dispatch, SetStateAction, FormEvent } from 'react'

import type { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import type { useUrlPagination } from '@/Hooks/useUrlPagination'
import type { uploadEditorImage } from '@/Services/Uploads'

export type ProfileMessageViewModel = {
  message: ProfileMessage
  sender: Profile | undefined
}

export type UseProfileMessagesPageResult = {
  requestedUrl: string
  session: AuthSession | null
  page: number
  pageSize: number
  setPage: ReturnType<typeof useUrlPagination>['setPage']
  content: string
  setContent: Dispatch<SetStateAction<string>>
  profileQuery: UseQueryResult<Profile | null>
  profile: Profile | null | undefined
  typeCompatibility: ReturnType<typeof useProfileTypeCompatibility>
  isProfileOwner: boolean
  messagesQuery: UseQueryResult<PaginatedResult<ProfileMessage>>
  messages: ProfileMessage[]
  totalItems: number
  senderProfilesQuery: UseQueryResult<Profile[]>
  messageItems: ProfileMessageViewModel[]
  canSendMessage: boolean
  canSubmitMessage: boolean
  isSendingMessage: boolean
  hasSendMessageError: boolean
  isInvalidMessageError: boolean
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  uploadEditorImage: typeof uploadEditorImage
}
