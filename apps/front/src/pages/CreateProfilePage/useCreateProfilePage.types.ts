import type { ProfileType } from '@/Models/Profile.model'
import type { FormEvent, Dispatch, SetStateAction } from 'react'
import type { UseEntityDetailsDraftResult } from '@/Hooks/Forms'
import type { uploadEditorImage } from '@/Services/Uploads'

export type UseCreateProfilePageResult = UseEntityDetailsDraftResult & {
  isAuthInitialized: boolean
  type: ProfileType
  setType: Dispatch<SetStateAction<ProfileType>>
  errorMessage: string
  isSubmitting: boolean
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  handleCancel: () => void
  uploadEditorImage: typeof uploadEditorImage
}
