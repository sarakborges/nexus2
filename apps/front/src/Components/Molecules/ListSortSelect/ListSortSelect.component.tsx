import { useId } from 'react'
import type { ListSort } from '@nexus/common'

import { SelectField } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import type { ListSortSelectProps } from './ListSortSelect.types'

export function ListSortSelect({ value, onChange }: ListSortSelectProps) {
  const { t } = useTranslations()
  const id = useId()

  return (
    <SelectField
      id={id}
      label={t('LIST_SORT_LABEL')}
      containerClassName="list-sort-select"
      value={value}
      onChange={(event) => onChange(event.target.value as ListSort)}
    >
      <option value="activity-desc">{t('LIST_SORT_ACTIVITY_DESC')}</option>
      <option value="activity-asc">{t('LIST_SORT_ACTIVITY_ASC')}</option>
      <option value="name-asc">{t('LIST_SORT_NAME_ASC')}</option>
      <option value="name-desc">{t('LIST_SORT_NAME_DESC')}</option>
    </SelectField>
  )
}
