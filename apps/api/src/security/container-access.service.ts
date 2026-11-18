import { randomUUID } from 'node:crypto';
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
    location?: string,
  ) {
    if (!name.trim() || name.length > 200) throw new Error('Invalid name');
    const editor = await tx.tenantMember.findFirst({
      where: { tenantId, userId, status: 'ACTIVE', role: { in: ['OWNER', 'EDITOR'] } },
      select: { id: true },
    });
    if (!editor) throw new Error('Access denied');
    const id = randomUUID();
    // A single INSERT without RETURNING avoids evaluating the stable read-policy
    // helper against a row not visible in its statement-start snapshot. The
    // unchanged INSERT RLS policy still validates actor, tenant and PRIVATE mode.
    await tx.container.createMany({
      data: [{ id, tenantId, ownerUserId: userId, shareMode: 'PRIVATE', name: name.trim(), publicToken, location: location?.trim() || null }],
    });
    return { id, shareMode: 'PRIVATE' as const };
  }

  async readVisible(tx: Prisma.TransactionClient, tenantId: string, containerId?: string) {
    return tx.$queryRaw<Array<{ id: string; name: string; location: string | null; shareMode: string; canManage: boolean; canEdit: boolean; itemCount: number }>>`
      SELECT c.id,c.name,c.location,c."shareMode",
       (c."ownerUserId"=security.actor_id() AND security.member_can_edit(c."tenantId",security.actor_id())) AS "canManage",
       security.container_allowed(c.id,c."tenantId",true) AS "canEdit",
       (SELECT count(*)::int FROM public."Item" i WHERE i."containerId"=c.id AND i."tenantId"=c."tenantId") AS "itemCount"
      FROM public."Container" c WHERE c."tenantId"=${tenantId}::uuid AND (${containerId ?? null}::uuid IS NULL OR c.id=${containerId ?? null}::uuid)
      ORDER BY c."createdAt" DESC,c.id LIMIT 200
    `;
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
