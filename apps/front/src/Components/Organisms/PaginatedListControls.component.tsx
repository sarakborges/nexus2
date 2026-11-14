import { useState, type FormEvent } from 'react'

import { useTranslations } from '@/Hooks/Language'
import { Button, Input, Label, Select } from '@/DesignSystem'
import type { PaginatedListControlsProps } from './PaginatedListControls.component.types'

export function PaginatedListControls({
  query,
  sort,
  onQueryChange,
  onSortChange,
  showQuery = true
}: PaginatedListControlsProps) {
  const { t } = useTranslations()
  const [value, setValue] = useState(query)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onQueryChange(value)
  }

  return (
    <div className="paginated-list-controls">
      {showQuery && (
        <form
          className="paginated-list-controls__search"
          role="search"
          onSubmit={submit}
        >
          <Input
            type="search"
            maxLength={120}
            value={value}
            placeholder={t('LIST_FILTER_PLACEHOLDER')}
            aria-label={t('LIST_FILTER_PLACEHOLDER')}
            onChange={(event) => setValue(event.target.value)}
          />
          <Button type="submit" variation="secondary" disabled={value.trim() === query.trim()}>
            {t('LIST_FILTER_SUBMIT')}
          </Button>
        </form>
      )}
      <Label className="paginated-list-controls__sort" htmlFor="list-sort">
        <span>{t('LIST_SORT_LABEL')}</span>
        <Select
          id="list-sort"
          value={sort}
          onChange={(event) => onSortChange(event.target.value as ListSort)}
        >
          <option value="activity-desc">{t('LIST_SORT_ACTIVITY_DESC')}</option>
          <option value="activity-asc">{t('LIST_SORT_ACTIVITY_ASC')}</option>
          <option value="name-asc">{t('LIST_SORT_NAME_ASC')}</option>
          <option value="name-desc">{t('LIST_SORT_NAME_DESC')}</option>
        </Select>
      </Label>
    </div>
  )
}
