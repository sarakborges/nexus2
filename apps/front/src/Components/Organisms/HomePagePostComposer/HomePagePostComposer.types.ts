import type { Profile } from '@nexus/common'
import type { FormEvent } from 'react'

import type { uploadEditorImage } from '@/Services/Uploads'

export type HomePagePostComposerProps = {
  currentProfile: Profile
}

export type UseHomePagePostComposerResult = {
  content: string
  setContent: (value: string) => void
  canSubmit: boolean
  isSubmitting: boolean
  hasError: boolean
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void
  uploadEditorImage: typeof uploadEditorImage
}
