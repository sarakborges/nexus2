import type { CommunityEditPageData } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'
import type { FormEvent } from 'react'

import type { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import type { uploadEditorImage } from '@/Services/Uploads'
import type { CommunityForm } from './EditCommunityPage.types'

export type UseEditCommunityPageResult = {
  requestedUrl: string
  communityEditPageQuery: UseQueryResult<CommunityEditPageData>
  community: CommunityEditPageData['community'] | undefined
  typeCompatibility: ReturnType<typeof useProfileTypeCompatibility>
  ownerProfileId: string | null
  isAuthInitialized: boolean
  form: CommunityForm | null
  errorMessage: string
  isSubmitting: boolean
  updateForm: (patch: Partial<CommunityForm>) => void
  updateCommunityPicture: (picture: string) => void
  cancelEdit: () => void
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  uploadEditorImage: typeof uploadEditorImage
}
