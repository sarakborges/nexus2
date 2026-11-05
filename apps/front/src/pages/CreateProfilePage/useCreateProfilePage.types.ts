import type { ProfileType } from '@/Models/Profile.model'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { uploadEditorImage } from '@/Services/Uploads'

export type UseCreateProfilePageResult = {
  isAuthInitialized: boolean
  name: string
  setName: Dispatch<SetStateAction<string>>
  url: string
  setUrl: Dispatch<SetStateAction<string>>
  picture: string
  setPicture: Dispatch<SetStateAction<string>>
  about: string
  setAbout: Dispatch<SetStateAction<string>>
  type: ProfileType
  setType: Dispatch<SetStateAction<ProfileType>>
  errorMessage: string
  isSubmitting: boolean
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  handleCancel: () => void
  uploadEditorImage: typeof uploadEditorImage
}
