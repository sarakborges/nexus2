import { QueryClient } from '@tanstack/react-query'
import axios from 'axios'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      gcTime: 5 * 60_000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
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
