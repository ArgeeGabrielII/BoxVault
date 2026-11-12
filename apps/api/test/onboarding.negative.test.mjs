/**
 * Token-bound tenant onboarding negative/positive gates.
 * CI ONLY: isolated ephemeral PostgreSQL, NEVER the shared Neon branch.
 * Requires both AUTHZ_ADMIN_DATABASE_URL and restricted AUTH_DATABASE_URL.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

test('ONBOARD-SEC: token-purpose, expiry, replay, cross-user and least-privilege gates', async () => {
  const adminUrl = process.env.AUTHZ_ADMIN_DATABASE_URL;
  const authUrl = process.env.AUTH_DATABASE_URL;
  assert.ok(adminUrl && authUrl, 'Dedicated test credentials required');
  const host = new URL(adminUrl).hostname;
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(host),
    'STOP: the onboarding fixture test is restricted to local ephemeral PostgreSQL');
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(new URL(authUrl).hostname),
    'STOP: auth runtime must target local ephemeral PostgreSQL');

  const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
  const runtime = new PrismaClient({ datasources: { db: { url: authUrl } } });
  const userId = randomUUID();
  const otherUserId = randomUUID();
  const tenantId = randomUUID();
  const secondTenant = randomUUID();
  const membershipId = randomUUID();
  const prefix = randomUUID();
  const valid = 'onboarding-valid-' + prefix;
  const alternate = 'onboarding-alternate-' + prefix;
  const reset = 'onboarding-reset-' + prefix;
  const expired = 'onboarding-expired-' + prefix;
  const spent = 'onboarding-spent-' + prefix;
  const other = 'onboarding-other-' + prefix;
  const invoke = (digest, tenant = randomUUID(), member = randomUUID()) =>
    runtime.$queryRaw`
      SELECT security.bootstrap_verified_email_tenant(
        ${digest}::text, ${tenant}::uuid, ${member}::uuid
      ) AS "userId"
    `;
  try {
    const [priv] = await admin.$queryRaw`
      SELECT
        has_function_privilege('boxvault_auth_runtime_m1',
          'security.bootstrap_verified_email_tenant(text,uuid,uuid)', 'EXECUTE') AS auth_execute,
        has_function_privilege('boxvault_runtime_m1',
          'security.bootstrap_verified_email_tenant(text,uuid,uuid)', 'EXECUTE') AS inventory_execute,
        has_schema_privilege('boxvault_auth_runtime_m1','security','USAGE') AS auth_schema
    `;
    assert.equal(priv.auth_execute, true);
    assert.equal(priv.auth_schema, true);
    assert.equal(priv.inventory_execute, false,
      'Inventory runtime must never execute onboarding');
    await admin.user.createMany({ data: [
      { id: userId, email: 'onboarding-' + prefix + '@example.invalid' },
      { id: otherUserId, email: 'onboarding-other-' + prefix + '@example.invalid' },
    ] });
    await admin.emailActionToken.createMany({ data: [
      { userId, kind: 'VERIFY_EMAIL', tokenHash: valid, expiresAt: new Date(Date.now() + 300000) },
      { userId, kind: 'VERIFY_EMAIL', tokenHash: alternate, expiresAt: new Date(Date.now() + 300000) },
      { userId, kind: 'RESET_PASSWORD', tokenHash: reset, expiresAt: new Date(Date.now() + 300000) },
      { userId, kind: 'VERIFY_EMAIL', tokenHash: expired, expiresAt: new Date(Date.now() - 60000) },
      { userId, kind: 'VERIFY_EMAIL', tokenHash: spent, expiresAt: new Date(Date.now() + 300000), usedAt: new Date() },
      { userId: otherUserId, kind: 'VERIFY_EMAIL', tokenHash: other, expiresAt: new Date(Date.now() + 300000) },
    ] });

    for (const digest of ['forged-' + prefix, reset, expired, spent]) {
      await assert.rejects(invoke(digest), 'Invalid proof must not create a tenant');
    }
    assert.equal(await admin.tenantMember.count({ where: { userId } }), 0);
    assert.equal((await admin.user.findUnique({ where: { id: userId } })).emailVerifiedAt, null);
    assert.equal((await admin.emailActionToken.findUnique({ where: { tokenHash: valid } })).usedAt, null);

    const rows = await invoke(valid, tenantId, membershipId);
    assert.equal(rows[0].userId, userId, 'Token must identify its owner, never arbitrary caller input');
    const member = await admin.tenantMember.findUnique({ where: { id: membershipId } });
    assert.equal(member.userId, userId);
    assert.equal(member.tenantId, tenantId);
    assert.equal(member.role, 'OWNER');
    assert.ok((await admin.user.findUnique({ where: { id: userId } })).emailVerifiedAt);
    await assert.rejects(invoke(valid), 'A consumed token must not replay');
    await assert.rejects(invoke(alternate), 'Other outstanding links must be invalidated');
    assert.equal(await admin.tenantMember.count({ where: { userId } }), 1);

    // A valid token for a different identity must provision ONLY that identity.
    const secondMembership = randomUUID();
    const second = await invoke(other, secondTenant, secondMembership);
    assert.equal(second[0].userId, otherUserId);
    assert.equal((await admin.tenantMember.findUnique({ where: { id: secondMembership } })).userId, otherUserId);

    // Reject verified accounts even if a new verify token was somehow issued.
    const extra = 'onboarding-postverified-' + prefix;
    await admin.emailActionToken.create({
      data: { userId, kind: 'VERIFY_EMAIL', tokenHash: extra, expiresAt: new Date(Date.now() + 300000) },
    });
    await assert.rejects(invoke(extra), 'Verified account cannot be reprovisioned');
    assert.equal((await admin.emailActionToken.findUnique({ where: { tokenHash: extra } })).usedAt, null,
      'Rejected transaction must not consume token');
  } finally {
    // Only ephemeral local CI fixtures. Preserve data on any remote system.
    await admin.tenantMember.deleteMany({ where: { userId: { in: [userId, otherUserId] } } });
    await admin.tenant.deleteMany({ where: { id: { in: [tenantId, secondTenant] } } });
    await admin.emailActionToken.deleteMany({ where: { userId: { in: [userId, otherUserId] } } });
    await admin.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await Promise.all([admin.$disconnect(), runtime.$disconnect()]);
  }
});
