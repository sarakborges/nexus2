import type { Community, CommunityRelationship } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'
import type { FormEvent } from 'react'

import type { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import type { uploadEditorImage } from '@/Services/Uploads'
import type { CommunityForm } from './EditCommunityPage.types'

export type UseEditCommunityPageResult = {
  requestedUrl: string
  communityQuery: UseQueryResult<Community | null>
  community: Community | null | undefined
  typeCompatibility: ReturnType<typeof useProfileTypeCompatibility>
  relationshipsQuery: UseQueryResult<CommunityRelationship[]>
  ownerProfileId: string | null
  form: CommunityForm | null
  errorMessage: string
  isSubmitting: boolean
  updateForm: (patch: Partial<CommunityForm>) => void
  updateCommunityPicture: (picture: string) => void
  cancelEdit: () => void
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  uploadEditorImage: typeof uploadEditorImage
}
