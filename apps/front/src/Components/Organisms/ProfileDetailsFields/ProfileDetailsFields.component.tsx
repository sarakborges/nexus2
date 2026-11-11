import type { ProfileDetailsFieldsProps } from './ProfileDetailsFields.types'

import { EntityDetailsFields } from '@/Components/Organisms/EntityDetailsFields'

export function ProfileDetailsFields(props: ProfileDetailsFieldsProps) {
  return <EntityDetailsFields entity="profile" {...props} />
}
