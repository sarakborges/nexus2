import type {
  AuthSession,
  Community,
  CommunityForumTopic,
  CommunityRelationship,
  Profile
} from '@nexus/common'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import type { CreateCommunityForumTopicMutationVariables } from '@/Hooks/CommunityForum'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { uploadEditorImage } from '@/Services/Uploads'

export type UseCreateCommunityForumTopicPageResult = {
  normalized: string
  session: AuthSession | null
  isAuthInitialized: boolean
  communityQuery: UseQueryResult<Community | null>
  community: Community | null | undefined
  relationshipsQuery: UseQueryResult<CommunityRelationship[]>
  ownedProfilesQuery: UseQueryResult<Profile[]>
  forumProfile: Profile | null
  title: string
  setTitle: Dispatch<SetStateAction<string>>
  content: string
  setContent: Dispatch<SetStateAction<string>>
  createMutation: Pick<
    UseMutationResult<CommunityForumTopic, unknown, CreateCommunityForumTopicMutationVariables, unknown>,
    'isPending' | 'isError'
  >
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  canSubmit: boolean
  uploadEditorImage: typeof uploadEditorImage
}
