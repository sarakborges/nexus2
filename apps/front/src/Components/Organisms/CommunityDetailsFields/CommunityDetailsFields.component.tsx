import type { CommunityDetailsFieldsProps } from './CommunityDetailsFields.types'

import { EntityDetailsFields } from '@/Components/Organisms/EntityDetailsFields'

export function CommunityDetailsFields(props: CommunityDetailsFieldsProps) {
  return <EntityDetailsFields entity="community" {...props} />
}
