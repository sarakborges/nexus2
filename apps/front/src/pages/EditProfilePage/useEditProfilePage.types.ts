import type { AuthSession, Profile } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'
import type { FormEvent } from 'react'

import type { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import type { uploadEditorImage } from '@/Services/Uploads'
import type { ProfileForm } from './EditProfilePage.types'

export type UseEditProfilePageResult = {
  requestedUrl: string
  session: AuthSession | null
  profileQuery: UseQueryResult<Profile | null>
  profile: Profile | null | undefined
  typeCompatibility: ReturnType<typeof useProfileTypeCompatibility>
  form: ProfileForm | null
  errorMessage: string
  isSubmitting: boolean
  updateForm: (patch: Partial<ProfileForm>) => void
  updateProfilePicture: (picture: string) => void
  cancelEdit: () => void
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  uploadEditorImage: typeof uploadEditorImage
}
