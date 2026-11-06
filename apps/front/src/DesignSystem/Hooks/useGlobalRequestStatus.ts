import { useIsFetching, useIsMutating } from '@tanstack/react-query'

import type { UseGlobalRequestStatusResult } from './useGlobalRequestStatus.types'

export function useGlobalRequestStatus(): UseGlobalRequestStatusResult {
  return useIsFetching() > 0 || useIsMutating() > 0
}
