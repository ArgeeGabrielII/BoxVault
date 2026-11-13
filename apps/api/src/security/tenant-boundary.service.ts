import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * This capability must be created ONLY after the authentication guard has
 * verified a signed, unexpired access credential and live session status
 * using a separate least-privileged authentication service/database identity.
 *
 * Never accept VerifiedPrincipal from request JSON, headers, or query params.
 * No real issuer/guard exists yet; do NOT expose inventory controllers.
 */
export interface VerifiedPrincipal {
  readonly userId: string;
  readonly sessionId: string;
  readonly verifiedAt: Date;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Content queries are strictly restricted to the runtime DB identity.
// It must not have SELECT access to AuthSession, TotpFactor or recovery codes.
@Injectable()
export class TenantBoundaryService implements OnModuleDestroy {
  private readonly prisma = new PrismaClient();

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async withAuthorizedTenant<T>(
    principal: VerifiedPrincipal,
    tenantId: string,
    operation: (tx: Prisma.TransactionClient, userId: string) => Promise<T>,
  ): Promise<T> {
    if (!principal || !uuidPattern.test(principal.userId) ||
        !uuidPattern.test(principal.sessionId) ||
        !(principal.verifiedAt instanceof Date) ||
        !Number.isFinite(principal.verifiedAt.getTime())) {
      throw new Error('Authentication required');
    }
    if (!uuidPattern.test(tenantId)) throw new Error('Invalid tenant identifier');

    // Fail closed for stale/invalid principal contexts. An actual AuthGuard
    // must validate session revocation, expiry, MFA and token issuer before
    // constructing the verified principal. This check alone is not AuthN.
    const age = Date.now() - principal.verifiedAt.getTime();
    if (age < -30_000 || age > 60_000) throw new Error('Authentication required');

    return this.prisma.$transaction(async tx => {
      // In this *same* transaction: no pooled connection can retain another
      // user's context after commit or rollback.
      await tx.$queryRaw`SELECT set_config('app.user_id', ${principal.userId}, true)`;
      await tx.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      const rows = await tx.$queryRaw<Array<{ allowed: boolean }>>`
        SELECT security.active_member(${tenantId}::uuid, ${principal.userId}::uuid) AS allowed
      `;
      if (rows.length !== 1 || rows[0].allowed !== true) {
        throw new Error('Access denied');
      }
      return operation(tx, principal.userId);
    }, { maxWait: 3_000, timeout: 10_000 });
  }
}
