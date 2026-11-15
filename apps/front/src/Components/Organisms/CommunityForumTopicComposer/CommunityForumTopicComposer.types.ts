import type { FormEvent } from 'react'

import type { uploadEditorImage } from '@/Services/Uploads'

export type CommunityForumTopicComposerProps = {
  title: string
  onTitleChange: (value: string) => void
  content: string
  onContentChange: (value: string) => void
  canSubmit: boolean
  isSubmitting: boolean
  hasError: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  onCancel: () => void
  onUploadImage: typeof uploadEditorImage
}
