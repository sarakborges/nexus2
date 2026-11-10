import type {
  AuthSession,
  Profile,
  ProfileMessagesPageData,
  Relationship
} from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'
import type { Dispatch, SetStateAction, FormEvent } from 'react'

import type { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import type { useUrlPagination } from '@/Hooks/useUrlPagination'
import type { uploadEditorImage } from '@/Services/Uploads'
import type { ProfileMessageViewModel } from './ProfileMessageList.types'

export type UseProfileMessagesPageResult = {
  requestedUrl: string
  session: AuthSession | null
  isAuthInitialized: boolean
  page: number
  pageSize: number
  setPage: ReturnType<typeof useUrlPagination>['setPage']
  content: string
  setContent: Dispatch<SetStateAction<string>>
  profileMessagesPageQuery: UseQueryResult<ProfileMessagesPageData>
  profile: Profile | null | undefined
  viewerRelationship: Relationship | null
  typeCompatibility: {
    isChecking: boolean
    isCompatible: boolean
    canInteract: boolean
  }
  isProfileOwner: boolean
  totalItems: number
  messageItems: ProfileMessageViewModel[]
  canSendMessage: boolean
  canSubmitMessage: boolean
  isSendingMessage: boolean
  hasSendMessageError: boolean
  isInvalidMessageError: boolean
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  uploadEditorImage: typeof uploadEditorImage
}
