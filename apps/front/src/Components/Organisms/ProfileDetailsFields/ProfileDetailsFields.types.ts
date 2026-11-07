import type { uploadEditorImage } from '@/Services/Uploads'

export type ProfileDetailsFieldsProps = {
  name: string
  url: string
  picture: string
  about: string
  onNameChange: (name: string) => void
  onUrlChange: (url: string) => void
  onPictureChange: (picture: string) => void
  onAboutChange: (about: string) => void
  targetId?: string
  onUploadImage: typeof uploadEditorImage
}
