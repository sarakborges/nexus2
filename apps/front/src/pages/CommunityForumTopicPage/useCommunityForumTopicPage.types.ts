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
  UseMutationResult,
  UseQueryResult
} from '@tanstack/react-query'
import type { Dispatch, FormEvent, SetStateAction } from 'react'

import type { useTranslations } from '@/Hooks/Language'
import type { useUrlPagination } from '@/Hooks/useUrlPagination'
import type { getCommunityRelationships } from '@/Services/CommunityRelationship'
import type { getCommunityByUrl } from '@/Services/Community'
import type { getCommunityForumTopic, createCommunityForumReply, moderateCommunityForumTopic, deleteCommunityForumTopic, deleteCommunityForumReply } from '@/Services/CommunityForum'
import type { getProfilesByIds } from '@/Services/Profile'
import type { uploadEditorImage } from '@/Services/Uploads'

export type CommunityForumTopicModerationChanges = {
  isPinned?: boolean
  isLocked?: boolean
}

type ReplyMutation = Pick<
  UseMutationResult<Awaited<ReturnType<typeof createCommunityForumReply>>, Error, void, unknown>,
  'isError' | 'isPending'
>
type ModerationMutation = Pick<
  UseMutationResult<Awaited<ReturnType<typeof moderateCommunityForumTopic>>, Error, CommunityForumTopicModerationChanges, unknown>,
  'mutate' | 'isPending'
>
type DeleteTopicMutation = Pick<
  UseMutationResult<Awaited<ReturnType<typeof deleteCommunityForumTopic>>, Error, void, unknown>,
  'mutate' | 'isPending'
>
type DeleteReplyMutation = Pick<
  UseMutationResult<Awaited<ReturnType<typeof deleteCommunityForumReply>>, Error, string, unknown>,
  'mutate' | 'isPending'
>

export type UseCommunityForumTopicPageResult = {
  topicId: string | undefined
  t: ReturnType<typeof useTranslations>['t']
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
  forumProfileId: string | null
  isMember: boolean
  isStaff: boolean
  canInteract: boolean
  topicQuery: UseQueryResult<CommunityForumTopicDetail>
  detail: CommunityForumTopicDetail | undefined
  topic: CommunityForumTopic | undefined
  replies: CommunityForumReply[]
  authorsQuery: UseQueryResult<Profile[]>
  authorsById: Map<string, Profile>
  replyMutation: ReplyMutation
  moderationMutation: ModerationMutation
  deleteTopicMutation: DeleteTopicMutation
  deleteReplyMutation: DeleteReplyMutation
  submitReply: (event: FormEvent<HTMLFormElement>) => Promise<void>
  uploadEditorImage: typeof uploadEditorImage
}
