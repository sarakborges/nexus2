import type {
  AuthSession,
  Community,
  CommunityForumComposerPageData
} from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'
import type { UseCreateCommunityForumTopicMutationResult } from '@/Hooks/CommunityForum'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { uploadEditorImage } from '@/Services/Uploads'

export type UseCreateCommunityForumTopicPageResult = {
  normalized: string
  session: AuthSession | null
  isAuthInitialized: boolean
  composerPageQuery: UseQueryResult<CommunityForumComposerPageData>
  community: Community | null | undefined
  forumProfile: CommunityForumComposerPageData['forumProfile']
  title: string
  setTitle: Dispatch<SetStateAction<string>>
  content: string
  setContent: Dispatch<SetStateAction<string>>
  createMutation: Pick<
    UseCreateCommunityForumTopicMutationResult,
    'isPending' | 'isError'
  >
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  canSubmit: boolean
  uploadEditorImage: typeof uploadEditorImage
}
