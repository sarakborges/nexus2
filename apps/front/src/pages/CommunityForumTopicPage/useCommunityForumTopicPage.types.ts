import type {
  AuthSession,
  Community,
  CommunityForumReply,
  CommunityForumTopic,
  CommunityForumTopicDetail,
  CommunityRelationship,
  Profile
} from '@nexus/common'
import type {
  UseQueryResult
} from '@tanstack/react-query'
import type { Dispatch, FormEvent, SetStateAction } from 'react'

import type { useUrlPagination } from '@/Hooks/useUrlPagination'
import type { getCommunityByUrl } from '@/Services/Community'
import type { uploadEditorImage } from '@/Services/Uploads'

export type CommunityForumTopicModerationChanges = {
  isPinned?: boolean
  isLocked?: boolean
}

export type CommunityForumReplyViewModel = {
  reply: CommunityForumReply
  author: Profile | undefined
  canDelete: boolean
}

export type UseCommunityForumTopicPageResult = {
  topicId: string | undefined
  session: AuthSession | null
  isAuthInitialized: boolean
  normalized: string
  page: number
  pageSize: number
  setPage: ReturnType<typeof useUrlPagination>['setPage']
  replyContent: string
  setReplyContent: Dispatch<SetStateAction<string>>
  communityQuery: UseQueryResult<Awaited<ReturnType<typeof getCommunityByUrl>>>
  community: Community | null | undefined
  relationshipsQuery: UseQueryResult<CommunityRelationship[]>
  ownedProfilesQuery: UseQueryResult<Profile[]>
  isMember: boolean
  isStaff: boolean
  canInteract: boolean
  topicQuery: UseQueryResult<CommunityForumTopicDetail>
  detail: CommunityForumTopicDetail | undefined
  topic: CommunityForumTopic | undefined
  topicAuthor: Profile | undefined
  canDeleteTopic: boolean
  replyItems: CommunityForumReplyViewModel[]
  authorsQuery: UseQueryResult<Profile[]>
  hasReplyError: boolean
  canSubmitReply: boolean
  isSendingReply: boolean
  isUpdatingTopic: boolean
  isDeletingTopic: boolean
  isDeletingReply: boolean
  togglePinned: () => void
  toggleLocked: () => void
  deleteTopic: () => void
  deleteReply: (replyId: string) => void
  submitReply: (event: FormEvent<HTMLFormElement>) => Promise<void>
  uploadEditorImage: typeof uploadEditorImage
}
