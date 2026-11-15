import { Button, Input } from '@/DesignSystem'
import { ListSortSelect } from '@/Components/Molecules/ListSortSelect'
import { useTranslations } from '@/Hooks/Language'
import { usePaginatedListControls } from './usePaginatedListControls'
import type { PaginatedListControlsProps } from './PaginatedListControls.types'

import './PaginatedListControls.style.scss'

export function PaginatedListControls({
  query,
  sort,
  onQueryChange,
  onSortChange
}: PaginatedListControlsProps) {
  const { t } = useTranslations()
  const { value, setValue, isUnchanged, submit } = usePaginatedListControls({
    query,
    onQueryChange
  })

  return (
    <div className="paginated-list-controls">
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
          onChange={event => setValue(event.target.value)}
        />
        <Button
          type="submit"
          variation="secondary"
          disabled={isUnchanged}
        >
          {t('LIST_FILTER_SUBMIT')}
        </Button>
      </form>
      <ListSortSelect value={sort} onChange={onSortChange} />
    </div>
  )
}
