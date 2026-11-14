import type { CommunityPrivacy } from '@nexus/common'
import type { FormEvent, Dispatch, SetStateAction } from 'react'
import type { UseEntityDetailsDraftResult } from '@/Hooks/Forms'
import type { uploadEditorImage } from '@/Services/Uploads'

export type UseCreateCommunityPageResult = UseEntityDetailsDraftResult & {
  privacy: CommunityPrivacy
  setPrivacy: Dispatch<SetStateAction<CommunityPrivacy>>
  errorMessage: string
  isSubmitting: boolean
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  handleCancel: () => void
  uploadEditorImage: typeof uploadEditorImage
}
