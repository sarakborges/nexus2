import { useState, type FormEvent } from 'react'
import type { ListSort } from '@nexus/common'
import { useTranslations } from '@/Hooks/Language'

type PaginatedListControlsProps = {
  query: string
  sort: ListSort
  onQueryChange: (query: string) => void
  onSortChange: (sort: ListSort) => void
  showQuery?: boolean
}

export function PaginatedListControls({query,sort,onQueryChange,onSortChange,showQuery=true}:PaginatedListControlsProps) {
  const { t } = useTranslations()
  const [value,setValue] = useState(query)
  const submit = (event:FormEvent<HTMLFormElement>) => { event.preventDefault(); onQueryChange(value) }
  return (
    <div className="paginated-list-controls">
      {showQuery && <form className="paginated-list-controls__search" role="search" onSubmit={submit}>
        <input type="search" maxLength={120} value={value} placeholder={t('LIST_FILTER_PLACEHOLDER')} aria-label={t('LIST_FILTER_PLACEHOLDER')} onChange={event=>setValue(event.target.value)} />
        <button type="submit" disabled={value.trim()===query.trim()}>{t('LIST_FILTER_SUBMIT')}</button>
      </form>}
      <label className="paginated-list-controls__sort">
        <span>{t('LIST_SORT_LABEL')}</span>
        <select value={sort} onChange={event=>onSortChange(event.target.value as ListSort)}>
          <option value="activity-desc">{t('LIST_SORT_ACTIVITY_DESC')}</option>
          <option value="activity-asc">{t('LIST_SORT_ACTIVITY_ASC')}</option>
          <option value="name-asc">{t('LIST_SORT_NAME_ASC')}</option>
          <option value="name-desc">{t('LIST_SORT_NAME_DESC')}</option>
        </select>
      </label>
    </div>
  )
}
