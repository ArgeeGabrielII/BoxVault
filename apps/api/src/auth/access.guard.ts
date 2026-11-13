import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, AccessPrincipal } from './auth.service';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { principal?: AccessPrincipal }>();
    const value = req.headers.authorization;
    if (!value || !/^Bearer [A-Za-z0-9._-]{20,4096}$/.test(value)) {
      throw new UnauthorizedException('Authentication required');
    }
    req.principal = await this.auth.verifyAccess(value.slice(7));
    return true;
  }
}
