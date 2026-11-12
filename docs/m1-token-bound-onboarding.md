# M1 token-bound personal tenant onboarding — implementation review

**Status:** Implementation committed on `feat/m1-auth-tenant-acl-rls` for draft PR #4. **No Neon migrations, GRANTs, or data writes have been authorized or run.**

## Threat model and trust boundaries

The original `security.bootstrap_personal_tenant(p_user, p_tenant, p_membership)` took an arbitrary user ID from the caller. Its `SECURITY DEFINER` execution could insert tenant/member rows for any verified user that lacked memberships if the function privilege were compromised or misused.

New migration: `apps/api/prisma/migrations/202611110005_token_bound_onboarding/migration.sql`.

- Removes the old UUID-based function and creates `security.bootstrap_verified_email_tenant(p_token_hash text, p_tenant uuid, p_membership uuid) RETURNS uuid`.
- No externally supplied user ID or transaction-local application actor claim. The user ID comes only from a matching, unexpired, unused `VERIFY_EMAIL` proof row.
- The definer function atomically consumes the token, locks the corresponding user, rejects an already verified or previously enrolled identity, inserts a personal tenant/owner membership, verifies the email, and consumes other outstanding verification tokens.
- `SET search_path = pg_catalog`; all referenced application tables and enum types are schema-qualified.
- Execution is revoked from `PUBLIC`. The privileged role to receive narrowly scoped EXECUTE, **only after review**, is `boxvault_auth_runtime_m1`. The inventory role must not be allowed to call this function.
- The NestJS `verifyEmail` path computes a keyed HMAC digest and calls the function using Prisma tagged raw SQL. It writes the fresh Argon2id password hash in the **same Serializable transaction**, so any error rolls back the token claim, verified flag, and tenant/member inserts.
- Reuse, wrong token purpose, expiry and already-verified cases raise SQLSTATE 42501 and are translated by NestJS to a uniform Unauthorized response.
- Concurrency for the same user is serialized via user row locking; two different tokens for the same user cannot create two personal tenants. Cross-tenant membership cannot be selected by supplying a fake user ID because no such parameter exists.

### Residual risks and required review

1. `SECURITY DEFINER` still delegates privileged DB inserts to a backend capability: the restricted authentication credential is a sensitive trust boundary and must remain server-only. Because this role can query verification-token hashes for other auth workflows, a **fully compromised auth DB credential is not isolated from all identity records**; consider splitting token issuance/redemption roles in a later milestone.
2. The migration intentionally **drops** the old function. It is an API-breaking security removal, **not a table/data deletion**. Deploy updated NestJS and reviewed scoped grants as an orchestrated release. Do not deploy the migration independently to a running old API.
3. Prisma's model schema diff will not detect changed security functions/grants. Validate function signatures, revocations, ACLs and RLS separately.
4. The original five migrations are **not marked applied on Neon**; verify baseline/001 equivalence and review Prisma history-adoption commands before executing any migrations.
5. Do not `prisma migrate dev`, `migrate deploy`, `db push`, or `migrate resolve` against shared Neon until explicit approval. Default `dev` branch must not be touched.
6. No new Neon branches, paid resources, or additional tenant data required for these CI checks.

## Tests and CI

- `apps/api/test/onboarding.negative.test.mjs`: runs **only** if both DB connection URLs resolve to loopback. Uses isolated PostgreSQL with fixture-created synthetic users/tokens; verifies invalid/expired/used/reset-purpose denial, verified-user denial, replay denial, cancellation of alternative tokens, no unauthorized membership creation, returned user binding, and lack of inventory runtime EXECUTE.
- `.github/workflows/m1-authorization.yml`: provisions limited inventory/auth roles, explicitly grants only the six RLS helpers to content runtime, explicitly grants the token-bound function to restricted auth runtime, and runs the new negative suite before the HTTP contract tests. The migration-history expectation is six files.
- `.github/workflows/m1-postgres-authz.yml`: replaces `EXECUTE ON ALL FUNCTIONS` with a fixed helper allowlist so future security functions aren't accidentally executable by inventory runtime.
- `AUTH-HTTP-08` existing API contract continues to cover real verification, one-time token use, tenant creation, password reset and login.

**CI success is required; simply committing tests is not evidence they passed.** After CI runs, review failure logs and repeat security tests on an explicitly approved disposable environment, not the existing Neon test data.

## Deployment order (not executed)

1. Re-review full equivalence of `000`/`001` on `m1-security-test` and approve adoption of migration history.
2. Approve and deploy migrations `002` through `005`, retaining existing tables, records and RLS policies.
3. Grant only `USAGE ON SCHEMA security` plus `EXECUTE ON FUNCTION security.bootstrap_verified_email_tenant(text,uuid,uuid)` to `boxvault_auth_runtime_m1`, after verifying it is non-superuser, non-bypass, non-owner.
4. Test the authentication role and content role against negative permission checks and a new disposable verified account. Verify all prior inventory counts.
5. Deploy updated NestJS with a maintenance/controlled rollout window, and run real verification-mail smoke test.
6. Keep PR #4 draft; merge only after separate explicit approval and all release gates pass.
