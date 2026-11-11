import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';

// This is the narrow data-access boundary for *future* authenticated endpoints.
// No controller currently invokes it. Keep access denied until session issuance,
// rate limiting and MFA challenge verification have shipped.
@Injectable()
export class TenantBoundaryService implements OnModuleDestroy {
  private readonly prisma = new PrismaClient();

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  // A session bearer is a secret: never log or persist raw values.
  // Session hashes require the same deployment pepper used at issuance time.
  private digest(raw: string): string {
    const pepper = process.env.AUTH_SESSION_PEPPER;
    if (!pepper || pepper.length < 32) throw new Error('Session pepper is not configured');
    return createHash('sha256').update(pepper).update('\0').update(raw).digest('hex');
  }

  async withAuthorizedTenant<T>(
    sessionBearer: string,
    tenantId: string,
    operation: (tx: Prisma.TransactionClient, userId: string) => Promise<T>,
  ): Promise<T> {
    if (!/^[0-9a-fA-F-]{36}$/.test(tenantId)) throw new Error('Invalid tenant identifier');
    if (!sessionBearer || sessionBearer.length < 32 || sessionBearer.length > 512) {
      throw new Error('Authentication required');
    }
    const now = new Date();
    // The auth repository must have tightly scoped access to AuthSession.
    // Admin/finance sessions must be separately classified before production.
    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash: this.digest(sessionBearer) },
      select: { userId: true, revokedAt: true, expiresAt: true },
    });
    if (!session || session.revokedAt || session.expiresAt <= now) {
      throw new Error('Authentication required');
    }
    return this.prisma.$transaction(async (tx) => {
      // set_config(..., true) scopes claims to THIS transaction only.
      // No application-supplied user ID is accepted.
      await tx.$queryRaw`SELECT set_config('app.user_id', ${session.userId}, true)`;
      await tx.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      const memberships = await tx.$queryRaw<Array<{ allowed: boolean }>>`
        SELECT security.active_member(${tenantId}::uuid, ${session.userId}::uuid) AS allowed
      `;
      if (memberships.length !== 1 || memberships[0].allowed !== true) {
        throw new Error('Access denied');
      }
      return operation(tx, session.userId);
    }, { maxWait: 3000, timeout: 10000 });
  }
}
