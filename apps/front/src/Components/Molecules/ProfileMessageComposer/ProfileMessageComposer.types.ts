import type { FormEvent } from 'react'

import type { uploadEditorImage } from '@/Services/Uploads'

export type ProfileMessageComposerProps = {
  hasSession: boolean
  isProfileOwner: boolean
  canSendMessage: boolean
  content: string
  onContentChange: (value: string) => void
  canSubmitMessage: boolean
  isSendingMessage: boolean
  hasSendMessageError: boolean
  isInvalidMessageError: boolean
  onUploadImage: typeof uploadEditorImage
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  replyToName?: string
  onCancelReply?: () => void
}
