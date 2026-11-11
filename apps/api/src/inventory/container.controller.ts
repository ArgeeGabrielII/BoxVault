import {
  Controller, Get, Param, Query, Req, UseGuards,
  BadRequestException, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AccessGuard } from '../auth/access.guard';
import { AccessPrincipal } from '../auth/auth.service';
import { TenantBoundaryService } from '../security/tenant-boundary.service';
import { ContainerAccessService } from '../security/container-access.service';

type AuthenticatedRequest = Request & { principal: AccessPrincipal };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Controller('containers')
@UseGuards(AccessGuard)
export class ContainerController {
  constructor(private readonly boundary: TenantBoundaryService,
              private readonly containers: ContainerAccessService) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest, @Query('tenantId') tenantId: string) {
    if (!tenantId || !UUID.test(tenantId)) throw new BadRequestException('tenantId must be UUID');
    try {
      const containers = await this.boundary.withAuthorizedTenant(
        req.principal, tenantId,
        async tx => this.containers.readVisible(tx, tenantId),
      );
      return { data: containers };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      if (err instanceof Error && err.message === 'Access denied') throw new ForbiddenException();
      throw err;
    }
  }

  @Get(':id')
  async get(@Req() req: AuthenticatedRequest,
            @Param('id') id: string, @Query('tenantId') tenantId: string) {
    if (!UUID.test(id) || !tenantId || !UUID.test(tenantId)) throw new BadRequestException();
    try {
      const item = await this.boundary.withAuthorizedTenant(req.principal, tenantId,
        async tx => tx.container.findFirst({
          where: { id, tenantId },
          select: { id: true, name: true, location: true, shareMode: true },
        }));
      if (!item) throw new NotFoundException('Resource unavailable');
      return { data: item };
    } catch (err) {
      if (err instanceof Error && err.message === 'Access denied') throw new NotFoundException('Resource unavailable');
      throw err;
    }
  }
}
