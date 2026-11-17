import { useAuthSession } from '@/Hooks/Auth'
import type { UseHomePageResult } from './useHomePage.types'

export function useHomePage(): UseHomePageResult {
  const homeQuery = useAuthSession()

  return { homeQuery }
}
