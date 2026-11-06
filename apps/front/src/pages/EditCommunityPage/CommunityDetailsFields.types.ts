import type { Community } from '@nexus/common'

import type { uploadEditorImage } from '@/Services/Uploads'
import type { CommunityForm } from './EditCommunityPage.types'

export type CommunityDetailsFieldsProps = {
  community: Pick<Community, 'id' | 'picture'>
  ownerProfileId: string
  form: CommunityForm
  onChange: (patch: Partial<CommunityForm>) => void
  onPictureChange: (picture: string) => void
  onUploadImage: typeof uploadEditorImage
}
