import { QueryClient } from '@tanstack/react-query'
import axios from 'axios'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchInterval: false,
      retry: (failureCount, error) => {
        if (
          failureCount >= 1 ||
          !axios.isAxiosError(error) ||
          axios.isCancel(error) ||
          error.code === 'ERR_CANCELED'
        ) return false
        const status = error.response?.status
        return status === undefined || status === 408 || status >= 500
      }
    },
    mutations: {
      retry: false
    }
  }
})
