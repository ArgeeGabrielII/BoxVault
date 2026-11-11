import { Controller, Get, UseGuards, ForbiddenException } from '@nestjs/common';
import { AccessGuard } from '../auth/access.guard';

// No admin-role model exists yet. Never treat a tenant OWNER as a platform admin.
// Authenticated access remains denied until independent mandatory-MFA admin guards exist.
@Controller('admin')
@UseGuards(AccessGuard)
export class AdminController {
  @Get('topups')
  topups() { throw new ForbiddenException('Platform administrative access not provisioned'); }
}
