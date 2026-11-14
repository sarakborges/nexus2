import type { FormEvent } from 'react'

import type { uploadEditorImage } from '@/Services/Uploads'

export type CommunityForumReplyComposerProps = {
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  canReply: boolean
  hasSession: boolean
  isMember: boolean
  isTopicLocked: boolean
  communityId: string
  value: string
  canSubmit: boolean
  isSending: boolean
  hasError: boolean
  onChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  onCancel: () => void
  onUploadImage: typeof uploadEditorImage
}
