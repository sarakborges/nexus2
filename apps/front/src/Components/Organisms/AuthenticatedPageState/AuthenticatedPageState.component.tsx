import { AccountCard } from '@/Components/Atoms/AccountCard'
import { RequestState } from '@/Components/Molecules/RequestState'
import { AuthenticatedPageTemplate } from '@/Components/Templates/AuthenticatedPageTemplate'

import type { AuthenticatedPageStateProps } from './AuthenticatedPageState.types'

export function AuthenticatedPageState({
  isLoading = false,
  isFetching = false,
  isError = false,
  onRetry
}: AuthenticatedPageStateProps) {
  return (
    <AuthenticatedPageTemplate>
      <AccountCard>
        <RequestState
          isLoading={isLoading}
          isFetching={isFetching}
          isError={isError}
          onRetry={onRetry}
        />
      </AccountCard>
    </AuthenticatedPageTemplate>
  )
}
