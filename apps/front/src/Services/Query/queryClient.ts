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
        if (axios.isAxiosError(error) && error.response?.status === 404)
          return false
        return failureCount < 1
      }
    },
    mutations: {
      retry: false
    }
  }
})
