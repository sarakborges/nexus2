import { useIsFetching, useIsMutating } from '@tanstack/react-query'

import type { UseGlobalRequestStatusResult } from './useGlobalRequestStatus.types'

export function useGlobalRequestStatus(): UseGlobalRequestStatusResult {
  const isFetching = useIsFetching() > 0
  const isMutating = useIsMutating() > 0
  return isFetching || isMutating
}
