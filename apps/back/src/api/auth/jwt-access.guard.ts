import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { AuthenticatedUser } from '@nexus/common'
import type { JwtPayload } from './auth.types'

@Injectable()
export class JwtAccessGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string }; user?: AuthenticatedUser }>()
    const value = request.headers.authorization
    const token = value?.startsWith('Bearer ') ? value.slice(7) : null
    if (!token) throw new UnauthorizedException('ACCESS_TOKEN_MISSING')
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token)
      if (payload.type !== 'access' || !payload.sub) throw new Error('wrong token type')
      request.user = { id: payload.sub, email: payload.email, profiles: [], currentProfile: null }
      return true
    } catch {
      throw new UnauthorizedException('ACCESS_TOKEN_INVALID_OR_EXPIRED')
    }
  }
}

@Injectable()
export class OptionalJwtAccessGuard extends JwtAccessGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string }; user?: AuthenticatedUser }>()
    // Public callers may omit a token; an expired supplied token must return 401
    // so the BFF can rotate the refresh token and retry the original request.
    if (!request.headers.authorization) return true
    return super.canActivate(context)
  }
}
