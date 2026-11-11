import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, AccessPrincipal } from '../auth/auth.service';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(ctx: ExecutionContext) {
    const req=ctx.switchToHttp().getRequest<Request & { principal: AccessPrincipal }>();
    const role=await this.auth.adminAccess(req.principal);
    // FINANCE routes never become accessible to a tenant owner or a generic
    // platform admin; only explicit payment reviewers can enter.
    if (role !== 'PAYMENT_REVIEWER')
      throw new ForbiddenException('Insufficient platform permission');
    return true;
  }
}
