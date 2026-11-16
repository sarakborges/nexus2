import type { AuthSession } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type UseAuthSessionResult = UseQueryResult<AuthSession | null, Error>
