import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { AuthenticatedUser } from '@nexus/common'
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthenticatedUser => context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user)
