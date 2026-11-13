import { Controller, Get, UseGuards, NotImplementedException } from '@nestjs/common';
import { AccessGuard } from '../auth/access.guard';
import { PlatformAdminGuard } from './platform-admin.guard';

// Authorization is complete for this placeholder only; finance application
// services are intentionally NOT published until they pass independent review.
@Controller('admin')
@UseGuards(AccessGuard, PlatformAdminGuard)
export class AdminController {
  @Get('topups')
  topups() {
    throw new NotImplementedException('Payment review service not released');
  }
}
