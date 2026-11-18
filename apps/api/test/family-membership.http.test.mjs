/** ID-03 real HTTP + PostgreSQL suite. Disposable loopback DB/SMTP only. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
const base = process.env.BOXVAULT_API_URL, adminUrl = process.env.AUTHZ_ADMIN_DATABASE_URL;
const contentUrl = process.env.DATABASE_URL, mailbox = process.env.BOXVAULT_TEST_MAIL_FILE;
assert.equal(process.env.NODE_ENV, 'test');
for (const address of [base, adminUrl, contentUrl]) {
  assert.ok(address, 'Explicit disposable fixture URLs required');
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(address).hostname), 'Only disposable loopback fixtures allowed');
}
assert.ok(mailbox, 'Synthetic SMTP inbox required');
assert.notEqual(adminUrl, contentUrl, 'Separate migration fixture and content identities required');
const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
const runtime = new PrismaClient({ datasources: { db: { url: contentUrl } } });
const inbox = () => fs.readFileSync(mailbox, 'utf8').replace(/=\r?\n/g, '').replace(/=3D/gi, '=');
async function request(path, who, method = 'GET', body) {
  const headers = { accept: 'application/json' };
  if (who?.access) headers.authorization = 'Bearer ' + who.access;
  if (body) headers['content-type'] = 'application/json';
  return fetch(new URL('/api/v1' + path, base), { method, headers, redirect: 'manual',
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
}
async function expect(path, who, method, body, status) {
  const response = await request(path, who, method, body);
  assert.equal(response.status, status, method + ' ' + path.replace(/[0-9a-f-]{36}/g, ':id'));
  return response;
}
function tokenFrom(portion, email, path) {
  const mail = portion.split('---END-MAIL---').find(part => part.includes(email) && part.includes(path));
  assert.ok(mail, 'Expected delivery to the intended synthetic recipient');
  const token = mail.match(/token=([A-Za-z0-9_-]{43})/)?.[1];
  assert.ok(token, 'SMTP proof must be present');
  return token;
}
const password = 'Synthetic-Family-Test-2026-Strong!';
async function login(who) {
  const response = await expect('/auth/login', null, 'POST', { email: who.email, password }, 201);
  who.access = (await response.json()).accessToken;
}
async function registered(suffix) {
  // Fixture-only reset, never a runtime rate-limit bypass.
  await admin.authRateLimit.deleteMany();
  const email = 'id03-' + randomBytes(6).toString('hex') + '-' + suffix + '@example.invalid';
  const before = inbox();
  await expect('/auth/register', null, 'POST', { email, password }, 201);
  const token = tokenFrom(inbox().slice(before.length), email, '/verify-email');
  await expect('/auth/verify-email', null, 'POST', { token, password }, 201);
  const who = { email, access: '' }; await login(who);
  const user = await admin.user.findUniqueOrThrow({ where: { email }, select: { id: true, memberships: { select: { tenantId: true, id: true } } } });
  return { ...who, id: user.id, tenant: user.memberships[0].tenantId, membership: user.memberships[0].id };
}
async function invited(owner, recipient, role = 'VIEWER') {
  const before = inbox();
  const response = await expect('/tenants/' + owner.tenant + '/invitations', owner, 'POST', { email: recipient.email, role }, 201);
  const json = await response.json(), delivered = inbox().slice(before.length);
  const proof = tokenFrom(delivered, recipient.email, '/accept-invitation');
  assert.ok(delivered.includes('/accept-invitation#token='), 'Invitation proof must be a URL fragment');
  assert.ok(!JSON.stringify(json).includes(proof));
  assert.deepEqual(Object.keys(json.data).sort(), ['expiresAt', 'id', 'status']);
  const row = await admin.familyInvitation.findUniqueOrThrow({ where: { id: json.data.id } });
  assert.equal(row.tokenHash, createHmac('sha256', process.env.AUTH_SESSION_PEPPER).update('family-invitation:' + proof).digest('hex'));
  assert.notEqual(row.tokenHash, proof);
  return { ...json.data, proof };
}
async function accept(who, invite, status = 201) {
  return expect('/invitations/accept', who, 'POST', { token: invite.proof }, status);
}
async function create(owner) {
  return (await (await expect('/containers', owner, 'POST', { tenantId: owner.tenant, name: 'Fictional private fixture' }, 201)).json()).data.id;
}
async function sharing(owner, box, shareMode, grants = []) {
  await expect('/containers/' + box + '/sharing', owner, 'PUT', { tenantId: owner.tenant, shareMode, grants }, 200);
}
const read = (who, tenant, box, status) => expect('/containers/' + box + '?tenantId=' + tenant, who, 'GET', undefined, status);

// One serial suite: each actor registers through HTTP and verifies an actual
// SMTP-delivered token before invitation acceptance. No pre-made JWT shortcuts.
test('ID-03: family lifecycle, tenant privacy, concurrency and immediate revocation', { timeout: 180000 }, async t => {
  t.after(async () => { await runtime.$disconnect(); await admin.$disconnect(); });
  const a = await registered('owner'), b = await registered('viewer'), c = await registered('editor');
  const d = await registered('other'), e = await registered('outsider'), f = await registered('extra');
  const plan = await admin.plan.create({ data: { id: randomUUID(), code: 'FAMILY', annualCredits: 1999, maxMembers: 4, maxContainers: 10, maxStorageMb: 10 } });
  // Synthetic entitlement fixture ONLY. No public plan activation/purchase API.
  const subscription = await admin.subscription.create({ data: { tenantId: a.tenant, planId: plan.id, status: 'ACTIVE', validUntil: new Date(Date.now() + 86400000) } });
  let invitation, box, familyBox;
  async function check(name, action) { await admin.authRateLimit.deleteMany(); await t.test(name, action); }

  await check('runtime cannot read identities/proofs/audit or mutate memberships directly', async () => {
    for (const table of ['User', 'AuthSession', 'FamilyInvitation', 'FamilyAuditEvent']) {
      const [priv] = await runtime.$queryRaw`SELECT has_table_privilege(current_user,format('public.%I',${table}::text),'SELECT') AS read,
        has_table_privilege(current_user,format('public.%I',${table}::text),'UPDATE') AS write,
        has_table_privilege(current_user,format('public.%I',${table}::text),'INSERT') AS insert,
        has_table_privilege(current_user,format('public.%I',${table}::text),'DELETE') AS delete`;
      assert.equal(priv.read, false); assert.equal(priv.write, false); assert.equal(priv.insert, false); assert.equal(priv.delete, false);
    }
    const [priv] = await runtime.$queryRaw`SELECT has_table_privilege(current_user,'public."TenantMember"','INSERT') AS insert,
      has_function_privilege(current_user,'security.family_owner(uuid)','EXECUTE') AS helper`;
    assert.equal(priv.insert, false); assert.equal(priv.helper, false);
    await assert.rejects(runtime.$queryRaw`SELECT security.family_workspaces()`);
  });
  await check('tenant selection contains only active own memberships', async () => {
    await expect('/tenants', null, 'GET', undefined, 401);
    const response = await expect('/tenants', b, 'GET', undefined, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const tenants = (await response.json()).data;
    assert.deepEqual(tenants.map(x => x.id), [b.tenant]); assert.equal(tenants[0].familyEligible, false);
    assert.equal((await (await expect('/tenants', a, 'GET', undefined, 200)).json()).data[0].familyEligible, true);
  });
  await check('only owner may manage membership; plan, role and body are server controlled', async () => {
    await expect('/tenants/' + a.tenant + '/members', e, 'GET', undefined, 404);
    await expect('/tenants/' + a.tenant + '/invitations', e, 'POST', { email: b.email, role: 'VIEWER' }, 404);
    await expect('/tenants/' + b.tenant + '/invitations', b, 'POST', { email: e.email, role: 'VIEWER' }, 409);
    await expect('/tenants/' + a.tenant + '/invitations', a, 'POST', { email: b.email, role: 'OWNER' }, 400);
    await expect('/tenants/' + a.tenant + '/invitations', a, 'POST', { email: b.email, role: 'VIEWER', tenantId: e.tenant }, 400);
    await expect('/tenants/' + a.tenant + '/invitations', a, 'POST', { email: '<bad@example.invalid>', role: 'VIEWER' }, 400);
  });
  await check('invite stores only hash, reserves a seat and rejects duplicate pending email', async () => {
    invitation = await invited(a, b);
    await expect('/tenants/' + a.tenant + '/invitations', a, 'POST', { email: b.email.toUpperCase(), role: 'VIEWER' }, 409);
    const data = (await (await expect('/tenants/' + a.tenant + '/invitations', a, 'GET', undefined, 200)).json()).data;
    assert.equal(data[0].email, b.email); assert.equal(data[0].status, 'PENDING');
    assert.ok(!JSON.stringify(data).includes('tokenHash')); assert.ok(!JSON.stringify(data).includes(invitation.proof));
  });
  await check('wrong recipient, invalid proof, expired proof and unrelated cancellation deny uniformly', async () => {
    await accept(e, invitation, 404);
    await accept(b, { proof: randomBytes(32).toString('base64url') }, 404);
    await expect('/invitations/accept', null, 'POST', { token: invitation.proof }, 401);
    await expect('/invitations/accept', { access: 'not-a-valid-bearer-token-for-fixture' }, 'POST', { token: invitation.proof }, 401);
    await expect('/invitations/accept', b, 'POST', { token: invitation.proof, tenantId: e.tenant }, 400);
    await expect('/tenants/' + e.tenant + '/invitations/' + invitation.id, e, 'DELETE', undefined, 404);
    const expired = await invited(a, d);
    await admin.familyInvitation.update({ where: { id: expired.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await accept(d, expired, 404);
    const rows = (await (await expect('/tenants/' + a.tenant + '/invitations', a, 'GET', undefined, 200)).json()).data;
    assert.equal(rows.find(x => x.id === expired.id).status, 'EXPIRED');
  });
  await check('verified recipient accepts once and keeps a separate personal workspace', async () => {
    const response = await accept(b, invitation); const member = (await response.json()).data;
    assert.equal(member.tenantId, a.tenant); assert.equal(member.role, 'VIEWER'); b.familyMembership = member.membershipId;
    await accept(b, invitation, 404);
    const tenants = (await (await expect('/tenants', b, 'GET', undefined, 200)).json()).data;
    assert.deepEqual(new Set(tenants.map(x => x.id)), new Set([a.tenant, b.tenant]));
    await expect('/tenants/' + a.tenant + '/members', b, 'GET', undefined, 404);
    await expect('/tenants/' + a.tenant + '/members/' + e.membership, a, 'PATCH', { role: 'EDITOR' }, 404);
    await expect('/tenants/' + a.tenant + '/members/' + e.membership, a, 'DELETE', undefined, 404);
    await expect('/tenants/' + a.tenant + '/members/' + b.familyMembership, b, 'PATCH', { role: 'EDITOR' }, 404);
  });
  await check('real two-account sequence: private denied → selected allowed → revoke denied with same session', async () => {
    box = await create(a); await read(b, a.tenant, box, 404);
    await sharing(a, box, 'SELECTED_MEMBERS', [{ userId: b.id, permission: 'VIEW' }]); await read(b, a.tenant, box, 200);
    await sharing(a, box, 'PRIVATE'); await read(b, a.tenant, box, 404); await read(a, a.tenant, box, 200);
    await expect('/containers/' + box + '/sharing', b, 'PUT', { tenantId: a.tenant, shareMode: 'ALL_FAMILY', grants: [] }, 404);
  });
  await check('new member sees ALL_FAMILY but never PRIVATE or another selected member’s box', async () => {
    familyBox = await create(a); await sharing(a, familyBox, 'ALL_FAMILY');
    await sharing(a, box, 'SELECTED_MEMBERS', [{ userId: b.id, permission: 'VIEW' }]);
    const join = await invited(a, c, 'EDITOR'); const membership = (await (await accept(c, join)).json()).data;
    c.familyMembership = membership.membershipId;
    await read(c, a.tenant, familyBox, 200); await read(c, a.tenant, box, 404); await read(e, a.tenant, familyBox, 404);
  });
  await check('owner cannot remove a member with owned containers or alter owner membership', async () => {
    c.ownedBox = await create({ ...c, tenant: a.tenant });
    const response = await expect('/tenants/' + a.tenant + '/members/' + c.familyMembership, a, 'DELETE', undefined, 409);
    assert.equal((await response.json()).error.code, 'ID03_MEMBER_OWNS_CONTAINERS');
    await read(a, a.tenant, c.ownedBox, 404); // Family ownership is never a content bypass.
    await expect('/tenants/' + a.tenant + '/members/' + a.membership, a, 'PATCH', { role: 'VIEWER' }, 409);
    await expect('/tenants/' + a.tenant + '/members/' + a.membership, a, 'DELETE', undefined, 409);
  });
  await check('role downgrade revokes sessions; freshly logged-in Viewer cannot create containers', async () => {
    await expect('/tenants/' + a.tenant + '/members/' + c.familyMembership, a, 'PATCH', { role: 'VIEWER' }, 200);
    await read(c, a.tenant, familyBox, 401); await login(c); await read(c, a.tenant, familyBox, 200);
    await expect('/containers', c, 'POST', { tenantId: a.tenant, name: 'denied fixture' }, 403);
  });
  await check('member removal revokes sessions and selected grants; rejoin does not resurrect grants', async () => {
    await admin.item.create({ data: { tenantId: a.tenant, containerId: box, name: 'Synthetic child' } });
    await admin.mediaAsset.create({ data: { tenantId: a.tenant, containerId: box, objectKey: 'fixture/id03/child', mimeType: 'image/png', byteSize: 10 } });
    const children = () => runtime.$transaction(async tx => {
      await tx.$queryRaw`SELECT set_config('app.user_id',${b.id},true)`;
      await tx.$queryRaw`SELECT set_config('app.tenant_id',${a.tenant},true)`;
      return [await tx.item.count({ where: { containerId: box } }), await tx.mediaAsset.count({ where: { containerId: box } })];
    });
    assert.deepEqual(await children(), [1, 1]);
    await expect('/tenants/' + a.tenant + '/members/' + b.familyMembership, a, 'DELETE', undefined, 200);
    assert.deepEqual(await children(), [0, 0]);
    await read(b, a.tenant, familyBox, 401); await login(b);
    await read(b, a.tenant, box, 404); await read(b, a.tenant, familyBox, 404);
    assert.deepEqual((await (await expect('/tenants', b, 'GET', undefined, 200)).json()).data.map(x => x.id), [b.tenant]);
    assert.equal(await admin.containerAccessGrant.count({ where: { tenantId: a.tenant, granteeUserId: b.id } }), 0);
    const rejoin = await invited(a, b); await accept(b, rejoin);
    await read(b, a.tenant, box, 404); await read(b, a.tenant, familyBox, 200);
    assert.deepEqual(await children(), [0, 0]);
  });
  await check('cancellation is idempotent and a failed delivery invalidates the proof and frees its seat', async () => {
    const cancel = await invited(a, d);
    await expect('/tenants/' + a.tenant + '/invitations/' + cancel.id, a, 'DELETE', undefined, 200);
    await expect('/tenants/' + a.tenant + '/invitations/' + cancel.id, a, 'DELETE', undefined, 200);
    await accept(d, cancel, 404);
    const response = await expect('/tenants/' + a.tenant + '/invitations', a, 'POST', { email: 'reject-family@example.invalid', role: 'VIEWER' }, 503);
    assert.ok(!JSON.stringify(await response.json()).includes('token'));
    const row = await admin.familyInvitation.findFirstOrThrow({ where: { tenantId: a.tenant, email: 'reject-family@example.invalid' } });
    assert.equal(row.status, 'CANCELED');
  });
  await check('concurrent last-seat invitations and repeated acceptance cannot exceed four members', async () => {
    const before = inbox();
    const recipients = [d, e];
    const responses = await Promise.all(recipients.map(who => request('/tenants/' + a.tenant + '/invitations', a, 'POST', { email: who.email, role: 'EDITOR' })));
    assert.deepEqual(responses.map(x => x.status).sort(), [201, 409]);
    const index = responses.findIndex(x => x.status === 201); const who = recipients[index];
    const pending = (await responses[index].json()).data;
    const proof = tokenFrom(inbox().slice(before.length), who.email, '/accept-invitation');
    const attempts = await Promise.all([request('/invitations/accept', who, 'POST', { token: proof }), request('/invitations/accept', who, 'POST', { token: proof })]);
    assert.deepEqual(attempts.map(x => x.status).sort(), [201, 404]);
    who.familyMembership = (await admin.tenantMember.findUniqueOrThrow({ where: { tenantId_userId: { tenantId: a.tenant, userId: who.id } } })).id;
    a.lastMember = who;
    assert.equal(await admin.tenantMember.count({ where: { tenantId: a.tenant, status: 'ACTIVE' } }), 4);
    const full = await expect('/tenants/' + a.tenant + '/invitations', a, 'POST', { email: f.email, role: 'VIEWER' }, 409);
    assert.equal((await full.json()).error.code, 'ID03_SEAT_LIMIT');
    assert.equal(await admin.familyAuditEvent.count({ where: { invitationId: pending.id, kind: 'INVITATION_ACCEPTED' } }), 1);
  });
  await check('container creation and membership removal serialize without orphaning private ownership', async () => {
    const member = a.lastMember;
    const responses = await Promise.all([
      request('/containers', member, 'POST', { tenantId: a.tenant, name: 'race fixture' }),
      request('/tenants/' + a.tenant + '/members/' + member.familyMembership, a, 'DELETE'),
    ]);
    const [created, removed] = responses.map(x => x.status);
    assert.ok((created === 201 && removed === 409) || ([401, 403].includes(created) && removed === 200));
  });
  await check('expired Family entitlement blocks new invites without bypassing membership management', async () => {
    await admin.subscription.update({ where: { id: subscription.id }, data: { validUntil: new Date(Date.now() - 1000) } });
    const response = await expect('/tenants/' + a.tenant + '/invitations', a, 'POST', { email: f.email, role: 'VIEWER' }, 409);
    assert.equal((await response.json()).error.code, 'ID03_FAMILY_PLAN_REQUIRED');
    await expect('/tenants/' + a.tenant + '/members', a, 'GET', undefined, 200);
  });
  await check('different reserved invitations can be accepted concurrently without exceeding the seat cap', async () => {
    for (const who of [e, b, c, d]) await login(who);
    await admin.subscription.create({ data: { tenantId: e.tenant, planId: plan.id, status: 'ACTIVE', validUntil: new Date(Date.now() + 86400000) } });
    const recipients = [b, c, d], pending = [];
    for (const who of recipients) pending.push(await invited(e, who));
    await expect('/tenants/' + e.tenant + '/invitations', e, 'POST', { email: f.email, role: 'VIEWER' }, 409);
    const results = await Promise.all(recipients.map((who, index) => request('/invitations/accept', who, 'POST', { token: pending[index].proof })));
    assert.deepEqual(results.map(x => x.status), [201, 201, 201]);
    assert.equal(await admin.tenantMember.count({ where: { tenantId: e.tenant, status: 'ACTIVE' } }), 4);
    for (let index = 0; index < recipients.length; index++) await accept(recipients[index], pending[index], 404);
  });
  await check('requests are rate limited and audit contains no email, proof or inventory payload fields', async () => {
    const statuses = [];
    for (let i = 0; i < 11; i++) statuses.push((await request('/tenants', a)).status);
    assert.equal(statuses.at(-1), 429);
    const events = await admin.familyAuditEvent.findMany({ where: { tenantId: a.tenant } });
    assert.ok(events.some(x => x.kind === 'MEMBER_REMOVED'));
    for (const row of events) assert.deepEqual(Object.keys(row).sort(), ['actorUserId', 'createdAt', 'id', 'invitationId', 'kind', 'targetUserId', 'tenantId']);
  });
});
