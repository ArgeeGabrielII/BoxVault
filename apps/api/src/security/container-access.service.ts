import { Injectable } from '@nestjs/common';
import { ContainerGrantPermission, ContainerShareMode, Prisma } from '@prisma/client';

// All calls REQUIRE an already authenticated and tenant-scoped transaction from
// TenantBoundaryService. Do not use PrismaClient directly in a route handler.
@Injectable()
export class ContainerAccessService {
  async createPrivate(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
    name: string,
    publicToken: string,
  ) {
    if (!name.trim() || name.length > 200) throw new Error('Invalid name');
    // The current DB policy insists that a new container be private and owned
    // by the authenticated actor. Token issuance must use a CSPRNG.
    return tx.container.create({
      data: { tenantId, ownerUserId: userId, shareMode: 'PRIVATE', name: name.trim(), publicToken },
      select: { id: true, shareMode: true },
    });
  }

  async readVisible(tx: Prisma.TransactionClient, tenantId: string) {
    // The DB policy performs the final object authorization, including the
    // owner/private/selected/all-family distinction.
    return tx.container.findMany({
      where: { tenantId },
      select: { id: true, name: true, location: true, shareMode: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async replaceSharing(
    tx: Prisma.TransactionClient,
    tenantId: string,
    actorUserId: string,
    containerId: string,
    mode: ContainerShareMode,
    grants: Array<{ userId: string; permission: ContainerGrantPermission }>,
  ) {
    const box = await tx.container.findFirst({
      where: { id: containerId, tenantId, ownerUserId: actorUserId },
      select: { id: true },
    });
    if (!box) throw new Error('Access denied');
    if (mode !== 'SELECTED_MEMBERS' && grants.length !== 0) {
      throw new Error('Grants permitted only for selected sharing');
    }
    if (new Set(grants.map(g => g.userId)).size !== grants.length) {
      throw new Error('Duplicate grantees');
    }
    // Validate every grantee against current active membership before any write.
    if (mode === 'SELECTED_MEMBERS') {
      const approved = await tx.tenantMember.count({
        where: { tenantId, userId: { in: grants.map(g => g.userId) }, status: 'ACTIVE' },
      });
      if (approved !== grants.length || grants.some(g => g.userId === actorUserId)) {
        throw new Error('Invalid grantee');
      }
    }
    await tx.containerAccessGrant.deleteMany({ where: { tenantId, containerId } });
    await tx.container.update({
      where: { id: containerId },
      data: { shareMode: mode },
    });
    if (mode === 'SELECTED_MEMBERS' && grants.length > 0) {
      await tx.containerAccessGrant.createMany({
        data: grants.map(g => ({
          tenantId, containerId, granteeUserId: g.userId,
          permission: g.permission, grantedBy: actorUserId,
        })),
      });
    }
    return { containerId, shareMode: mode };
  }
}
