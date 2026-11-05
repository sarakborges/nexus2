import type { CommunityPrivacy } from '@nexus/common'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { uploadEditorImage } from '@/Services/Uploads'

export type UseCreateCommunityPageResult = {
  name: string
  setName: Dispatch<SetStateAction<string>>
  url: string
  setUrl: Dispatch<SetStateAction<string>>
  picture: string
  setPicture: Dispatch<SetStateAction<string>>
  about: string
  setAbout: Dispatch<SetStateAction<string>>
  privacy: CommunityPrivacy
  setPrivacy: Dispatch<SetStateAction<CommunityPrivacy>>
  errorMessage: string
  isSubmitting: boolean
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  handleCancel: () => void
  uploadEditorImage: typeof uploadEditorImage
}
