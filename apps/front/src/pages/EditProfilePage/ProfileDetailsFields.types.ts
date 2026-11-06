import type { Profile } from '@nexus/common'

import type { uploadEditorImage } from '@/Services/Uploads'
import type { ProfileForm } from './EditProfilePage.types'

export type ProfileDetailsFieldsProps = {
  profile: Pick<Profile, 'id' | 'picture'>
  form: ProfileForm
  onChange: (patch: Partial<ProfileForm>) => void
  onPictureChange: (picture: string) => void
  onUploadImage: typeof uploadEditorImage
}
