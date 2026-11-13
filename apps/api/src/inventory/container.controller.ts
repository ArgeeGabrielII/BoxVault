import {
  Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards,
  BadRequestException, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { randomBytes } from 'node:crypto';
import type { ContainerGrantPermission, ContainerShareMode } from '@prisma/client';
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

  /** Creates a private container in the caller's active tenant. */
  @Post()
  async create(@Req() req: AuthenticatedRequest,
               @Body() body: { tenantId?: unknown; name?: unknown }) {
    if (typeof body?.tenantId !== 'string' || !UUID.test(body.tenantId) ||
        typeof body?.name !== 'string' || !body.name.trim() || body.name.length > 200)
      throw new BadRequestException('Invalid container details');
    try {
      const result = await this.boundary.withAuthorizedTenant(
        req.principal, body.tenantId,
        async (tx, userId) => this.containers.createPrivate(
          tx, body.tenantId as string, userId, body.name as string,
          randomBytes(32).toString('base64url'),
        ),
      );
      return { data: result };
    } catch (err) {
      if (err instanceof Error && err.message === 'Access denied')
        throw new ForbiddenException();
      throw err;
    }
  }

  /**
   * Replaces all sharing grants atomically. Only the container creator can
   * manage access, even if another member has EDIT access to child items.
   * The tenant and container IDs are never sufficient without a live session.
   */
  @Put(':id/sharing')
  async replaceSharing(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: {
      tenantId?: unknown; shareMode?: unknown;
      grants?: unknown;
    },
  ) {
    if (!UUID.test(id) || typeof body?.tenantId !== 'string' ||
        !UUID.test(body.tenantId) ||
        !['PRIVATE', 'SELECTED_MEMBERS', 'ALL_FAMILY'].includes(String(body.shareMode)) ||
        !Array.isArray(body.grants) || body.grants.length > 4 ||
        body.grants.some((entry: unknown) => {
          if (!entry || typeof entry !== 'object') return true;
          const value = entry as Record<string, unknown>;
          return typeof value.userId !== 'string' || !UUID.test(value.userId) ||
            !['VIEW', 'EDIT'].includes(String(value.permission));
        }))
      throw new BadRequestException('Invalid container sharing details');

    const grants = body.grants as Array<{ userId: string; permission: ContainerGrantPermission }>;
    if ((body.shareMode !== 'SELECTED_MEMBERS' && grants.length !== 0) ||
        new Set(grants.map(g => g.userId.toLowerCase())).size !== grants.length)
      throw new BadRequestException('Invalid sharing grants');

    try {
      const data = await this.boundary.withAuthorizedTenant(
        req.principal, body.tenantId,
        async (tx, userId) => this.containers.replaceSharing(
          tx, body.tenantId as string, userId, id,
          body.shareMode as ContainerShareMode, grants,
        ),
      );
      return { data };
    } catch (err) {
      // No existence hints for another user's container or another tenant.
      if (err instanceof Error && ['Access denied', 'Invalid grantee'].includes(err.message))
        throw new NotFoundException('Resource unavailable');
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
