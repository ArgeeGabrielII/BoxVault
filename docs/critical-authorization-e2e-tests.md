# Critical end-to-end authorization test (Milestone 1)

**Implementation:** [../apps/api/test/authorization.e2e.test.mjs](../apps/api/test/authorization.e2e.test.mjs)

This is a **real PostgreSQL database integration test**, not a mocked unit test. It exercises Prisma/PostgreSQL RLS; it does **not** exercise HTTP since authenticated tenant/container endpoints have not been implemented. It must not be represented as a complete API E2E suite.

## Run it

Use an isolated disposable PostgreSQL instance with the Prisma base schema and the **reviewed, applied** M1 ACL/RLS migration. The current migration is draft; role provisioning and baseline migration must be completed before the test can pass. Create separate privileged fixture and restricted runtime database identities.

Set `AUTHZ_ADMIN_DATABASE_URL` for the fixture database identity (BYPASSRLS) and `AUTHZ_RUNTIME_DATABASE_URL` for the restricted production-equivalent identity (non-superuser, no BYPASSRLS, no table ownership). Do not put credentials in Git.

Run `pnpm --filter @boxvault/api db:generate` then `pnpm --filter @boxvault/api test:authz:e2e`.

Missing URLs are a **hard failure**, not a skipped test. Do not enable this as a passing release gate until PostgreSQL setup and negative tests actually run.

## Test cases

- **SEC-00:** RLS ENABLE/FORCE, restricted app role, no ambient reads.
- **SEC-01:** Seed synthetic tenants A/B, family roles, PRIVATE/SELECTED/ALL_FAMILY and child item/media records.
- **SEC-02:** Cross-tenant UUID tampering and forged tenant selection denied.
- **SEC-03:** Private content invisible to siblings and operator.
- **SEC-04:** Selected member grants obey role ceilings for read and write.
- **SEC-05:** Family-wide reading only for active members; viewer denied mutations.
- **SEC-06:** Revoked member immediately loses direct child and container access.
- **SEC-07:** Missing actor/tenant claims fail closed.
- **SEC-08:** QR locator token is not authorization.
- **SEC-09:** Non-owner cannot widen sharing.
- **SEC-10:** An editor with access to ALL_FAMILY cannot rewrite another owner's share mode or take ownership of that container; current draft RLS may fail this intentionally strict test.

## Production acceptance limitations

Tests not yet executed in a configured PostgreSQL environment. Additional required coverage: HTTP 401/403/404 and MFA behavior after authenticated controllers exist; media signed URL issuance; aggregate/search leaks; concurrent revocation and ACL updates; role escalation through direct SQL; auth/session expiry and refresh replay; foreign-key integrity and pooled transactions; security-function ownership and GRANT restrictions. Do not merge M1 until these controls are exercised successfully.
