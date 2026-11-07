import type { AvatarPurpose } from '@/Hooks/Uploads'
import type { uploadEditorImage } from '@/Services/Uploads'
import type { TranslationKey } from '@/Types/Translation.type'

export type EntityDetailsEntity = 'profile' | 'community'

export type EntityDetailsFieldConfig = {
  avatarLabel: TranslationKey
  avatarPurpose: AvatarPurpose
  nameLabel: TranslationKey
  urlLabel: TranslationKey
  urlPlaceholder: TranslationKey
  urlHelp: TranslationKey
  aboutLabel: TranslationKey
  aboutMaxLength: TranslationKey
}

type SharedEntityDetailsFieldsProps = {
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

export type EntityDetailsFieldsProps =
  | (SharedEntityDetailsFieldsProps & {
      entity: 'profile'
      actorProfileId?: never
    })
  | (SharedEntityDetailsFieldsProps & {
      entity: 'community'
      actorProfileId?: string
    })
