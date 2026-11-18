import { Injectable, OnModuleDestroy, UnauthorizedException, HttpException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHmac, randomBytes } from 'node:crypto';
import type { AccessPrincipal } from '../auth/auth.service';
import { AuthHardeningService } from '../auth/auth-hardening.service';

@Injectable()
export class FamilyService implements OnModuleDestroy {
  // Content runtime only. No migration-owner URL or auth-table grants.
  private readonly db = new PrismaClient();
  constructor(private readonly hardening: AuthHardeningService) {}
  async onModuleDestroy() { await this.db.$disconnect(); }

  private proof(token: string) {
    const pepper = process.env.AUTH_SESSION_PEPPER;
    if (!pepper || pepper.length < 32) throw new ServiceUnavailableException('Family invitations are not configured');
    return createHmac('sha256', pepper).update('family-invitation:' + token).digest('hex');
  }
  private async run(principal: AccessPrincipal, operation: (tx: Prisma.TransactionClient) => Promise<unknown>) {
    const age = Date.now() - principal.verifiedAt.getTime();
    if (!Number.isFinite(age) || age < -30_000 || age > 60_000) throw new UnauthorizedException();
    try {
      return await this.db.$transaction(async tx => {
        await tx.$queryRaw`SELECT set_config('app.user_id', ${principal.userId}, true)`;
        await tx.$queryRaw`SELECT set_config('app.session_id', ${principal.sessionId}, true)`;
        return operation(tx);
      }, { maxWait: 3000, timeout: 10000 });
    } catch (error) {
      // Allowlisted business errors only. Never log SQL messages (which can
      // contain recipient emails), proof hashes, request bodies or raw tokens.
      const message = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2010'
        ? String(error.meta?.message ?? '') : '';
      const code = message.match(/ID03_[A-Z_]+/)?.[0];
      const errors: Record<string, [number, string]> = {
        ID03_UNAUTHENTICATED: [401, 'Authentication required'],
        ID03_RESOURCE_UNAVAILABLE: [404, 'Resource unavailable'],
        ID03_INVALID_INPUT: [400, 'Invalid family details'],
        ID03_FAMILY_PLAN_REQUIRED: [409, 'An active Family plan is required'],
        ID03_MEMBER_ACTIVE: [409, 'This member is already active in this workspace'],
        ID03_INVITATION_PENDING: [409, 'An invitation is already pending for this workspace'],
        ID03_INVITATION_USED: [409, 'This invitation cannot be canceled'],
        ID03_SEAT_LIMIT: [409, 'Family limit reached: four members including the owner'],
        ID03_OWNER_IMMUTABLE: [409, 'Owner membership cannot be changed through this operation'],
        ID03_MEMBER_OWNS_CONTAINERS: [409, 'Member owns containers; ownership must be resolved before removal'],
      };
      if (code && errors[code]) {
        const [status, safe] = errors[code];
        throw new HttpException({ error: { code, message: safe } }, status);
      }
      throw new ServiceUnavailableException('Family operation unavailable');
    }
  }
  workspaces(p: AccessPrincipal) {
    return this.run(p, async tx => (await tx.$queryRaw<Array<{ data: Prisma.JsonValue }>>`SELECT security.family_workspaces() AS data`)[0].data);
  }
  members(p: AccessPrincipal, tenant: string) {
    return this.run(p, async tx => (await tx.$queryRaw<Array<{ data: Prisma.JsonValue }>>`SELECT security.family_members(${tenant}::uuid) AS data`)[0].data);
  }
  invitations(p: AccessPrincipal, tenant: string) {
    return this.run(p, async tx => (await tx.$queryRaw<Array<{ data: Prisma.JsonValue }>>`SELECT security.family_invitations(${tenant}::uuid) AS data`)[0].data);
  }
  async invite(p: AccessPrincipal, tenant: string, email: string, role: 'EDITOR' | 'VIEWER') {
    this.hardening.assertMailerConfigured();
    const token = randomBytes(32).toString('base64url');
    const hash = this.proof(token);
    const result = await this.run(p, async tx => (await tx.$queryRaw<Array<{ data: { id: string; expiresAt: string; status: string } }>>`
      SELECT security.family_invite(${tenant}::uuid,${email},${role},${hash}) AS data`)[0].data) as { id: string; expiresAt: string; status: string };
    try {
      await this.hardening.email(email, 'family-invitation', token);
    } catch {
      // Delivery has an uncertain outcome, so invalidate this proof rather
      // than leave a usable invite or indefinitely reserve a failed seat.
      await this.cancel(p, tenant, result.id);
      throw new ServiceUnavailableException('Invitation delivery failed; please retry');
    }
    return result; // Never expose the proof, hash, or email link in JSON.
  }
  cancel(p: AccessPrincipal, tenant: string, invitation: string) {
    return this.run(p, async tx => (await tx.$queryRaw<Array<{ data: Prisma.JsonValue }>>`
      SELECT security.family_cancel(${tenant}::uuid,${invitation}::uuid) AS data`)[0].data);
  }
  accept(p: AccessPrincipal, token: string) {
    const hash = this.proof(token);
    return this.run(p, async tx => (await tx.$queryRaw<Array<{ data: Prisma.JsonValue }>>`
      SELECT security.family_accept(${hash}) AS data`)[0].data);
  }
  changeRole(p: AccessPrincipal, tenant: string, member: string, role: 'EDITOR' | 'VIEWER') {
    return this.run(p, async tx => (await tx.$queryRaw<Array<{ data: Prisma.JsonValue }>>`
      SELECT security.family_change_role(${tenant}::uuid,${member}::uuid,${role}) AS data`)[0].data);
  }
  remove(p: AccessPrincipal, tenant: string, member: string) {
    return this.run(p, async tx => (await tx.$queryRaw<Array<{ data: Prisma.JsonValue }>>`
      SELECT security.family_remove(${tenant}::uuid,${member}::uuid) AS data`)[0].data);
  }
}
