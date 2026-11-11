import type { AuthSession, Profile, ProfileEditPageData } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'
import type { FormEvent } from 'react'

import type { uploadEditorImage } from '@/Services/Uploads'
import type { ProfileForm } from './EditProfilePage.types'

export type UseEditProfilePageResult = {
  requestedUrl: string
  session: AuthSession | null
  isAuthInitialized: boolean
  profileEditPageQuery: UseQueryResult<ProfileEditPageData>
  profile: Profile | null | undefined
  typeCompatibility: {
    isChecking: boolean
    isCompatible: boolean
  }
  form: ProfileForm | null
  errorMessage: string
  isSubmitting: boolean
  updateForm: (patch: Partial<ProfileForm>) => void
  updateProfilePicture: (picture: string) => void
  cancelEdit: () => void
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  uploadEditorImage: typeof uploadEditorImage
}
