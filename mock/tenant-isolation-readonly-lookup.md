# M1 — Read-only tenant ID lookup for browser isolation tests

**Scope:** isolated Neon `m1-security-test` only. This step does not modify data or change runtime permissions.

The local HTML registration tester needs two **tenant UUIDs**: the tenant belonging to the account you just logged into, and an unrelated existing synthetic test tenant. The API deliberately does not allow the user to enumerate other tenants; fetch these IDs separately through an operator-controlled, read-only Prisma query.

## Run the lookup

From `apps/api` in the BoxVault repository, paste this complete block. It checks the exact test-branch **direct** endpoint and the migration role; credentials are read from `.env` but never printed.

```bash
cd ~/Documents/Personal/BoxVault-App/apps/api

node --env-file=.env <<'NODE'
const { PrismaClient } = require('@prisma/client');
const { createInterface } = require('node:readline/promises');

const url = new URL(process.env.DIRECT_URL || 'invalid:');
if (
  url.hostname !== 'ep-purple-butterfly-b3r5xmh2.c-4.ap-southeast-1.aws.neon.tech' ||
  decodeURIComponent(url.username) !== 'neondb_owner' ||
  url.pathname !== '/neondb'
) {
  console.error('STOP: Expected the isolated test branch direct database URL');
  process.exit(1);
}

const ask = createInterface({ input: process.stdin, output: process.stdout });
async function main() {
  const email = (await ask.question('Enter the email address you just logged in with: ')).trim().toLowerCase();
  ask.close();
  if (!email || !email.includes('@')) throw new Error('Invalid email address');

  const db = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
  try {
    const own = await db.$queryRaw`
      SELECT tm."tenantId" AS id
      FROM public."TenantMember" tm
      JOIN public."User" u ON u.id = tm."userId"
      WHERE lower(u.email) = ${email}
        AND tm.status::text = 'ACTIVE'
      ORDER BY tm."tenantId" LIMIT 5
    `;
    const unrelated = await db.$queryRaw`
      SELECT t.id
      FROM public."Tenant" t
      WHERE NOT EXISTS (
        SELECT 1 FROM public."TenantMember" tm
        JOIN public."User" u ON u.id = tm."userId"
        WHERE tm."tenantId" = t.id AND lower(u.email) = ${email}
      )
      ORDER BY t."createdAt" DESC
      LIMIT 1
    `;
    if (own.length !== 1 || unrelated.length !== 1)
      throw new Error('Expected one personal tenant and one unrelated test tenant. Check account status.');
    console.log('Your tenant UUID:       ', own[0].id);
    console.log('Unrelated tenant UUID:  ', unrelated[0].id);
    console.log('Read-only lookup complete; no data changed.');
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => { ask.close(); console.error('Lookup failed; review local environment and account.'); process.exitCode = 1; });
NODE
```

Only the UUIDs appear in output; the script does not print the address or credentials. Use a dedicated synthetic test account, not a real customer account. Don't put these lookup commands in the production API or web application.

## Run the test

1. Pull the latest feature branch and refresh `http://localhost:5173/boxvault-m1-registration-harness.html`.
2. Enter your public reCAPTCHA v3 key, registered email and **verification-established password**. Click **4. Login** again after the refresh: access tokens are never persisted across page reloads.
3. Copy the two UUIDs from the lookup into the **your tenant** and **unrelated tenant** fields. No API passwords or tokens are needed.
4. Click **5. Run read-only tenant isolation checks**.

Expected: unauthenticated query **401**, own-tenant list **200**, unrelated-tenant list **403**. An empty own-tenant container list is a legitimate success for a newly created personal tenant.

The button deliberately returns only HTTP status codes and the number of visible own-tenant containers; it does **not** display container content or the session credential. Use **Forget access token** or refresh when finished.

**Limitation:** These three checks do not validate sharing modes, object-level media permissions, mutation denial, or cross-account family grants; those require separate tests and evidence in CI and future API acceptance suites.
