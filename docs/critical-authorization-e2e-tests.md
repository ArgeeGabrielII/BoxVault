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

## Automated, free execution path

A proposed GitHub Actions gate now exists at [M1 Postgres Authorization Gate](../.github/workflows/m1-authorization.yml). It starts **ephemeral PostgreSQL 18** on a public-repository GitHub-hosted runner; it does **not** use Neon compute, Neon credentials, or the persistent `dev` branch. The baseline is generated from `apps/api/prisma/baseline.prisma` in the runner and is followed by the draft M1 migration. It provisions a non-BYPASSRLS runtime identity and executes the Node test suite.

**Execution evidence:** no successful GitHub Actions run observed as of 2026-11-11. Keep it as an unverified security gate until a real green run is inspected, and commit a real versioned baseline migration after reviewing the generated SQL.

## Revoked sharing grant regression

The isolated Neon `m1-security-test` branch exposed a leak: a REMOVED member could read a historical `ContainerAccessGrant` while container and child reads were blocked. The live policy was corrected in the test branch and the SQL migration changed to use `security.grant_visible` with an active membership check. SEC-06 now explicitly tests grant metadata revocation.

Read-only Neon checks **passed** on the actual `public` schema using the restricted `boxvault_runtime_m1` identity: removed member saw 0 grants/containers/items/media; unauthorized tenant selection saw 0; no-context queries saw 0; and auth-session and TOTP tables were not readable by the content runtime identity. This is not the same as running the complete Node.js E2E suite.
