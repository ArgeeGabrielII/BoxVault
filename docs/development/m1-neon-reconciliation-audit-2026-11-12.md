# M1 live Neon reconciliation audit — 2026-11-12

**Status:** READ-ONLY INSPECTION COMPLETED; RECONCILIATION NOT APPROVED OR APPLIED.  
**Repository branch:** `feat/m1-auth-tenant-acl-rls`; PR #4 must remain draft.  
**Neon project:** `shiny-field-66278071`; inspected branch ONLY: `br-fragrant-salad-b3ntdaa0` (`m1-security-test`).  
**Default `dev` branch:** not modified. No additional branch, paid compute or plan changes.

## Evidence gathered

- Current Prisma schema and all five migration files were inspected alongside `docs/README.md`, `docs/security/m1-authentication-hardening.md`, `docs/security/m1-security-gate-status.md`, and `docs/development/m1-neon-free-tier-validation.md`.
- Live `public` database contains the original auth, inventory, tenancy and billing tables plus `m1lab` fixtures. Six tables absent: `AuthChallenge`, `EmailActionToken`, `AuthRateLimit`, `AuthAuditEvent`, `PlatformOperator`, `RefreshTokenReuse`.
- Existing columns `User.emailVerifiedAt` and `AuthSession.privilegedStepUpAt` absent.
- `security.bootstrap_personal_tenant(uuid,uuid,uuid)` absent.
- `_prisma_migrations` absent. `User` contains six rows; do not delete or overwrite them.
- Inventory and finance tables inspected have `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`; existing security helper functions remain. Table and function owners are `neondb_owner`.
- `boxvault_auth_runtime_m1` has neither existing auth-table DML privileges nor EXECUTE on the six current security helper functions. It has no inventory DML privileges.
- `boxvault_runtime_m1` has scoped inventory DML privileges, none on existing authentication/billing tables.
- Both application roles have `BYPASSRLS=false`, `CREATEROLE=false`; role-membership query showed no parent roles for either.
- Legacy `boxvault_auth_m1` still inherits `neon_superuser` and has `BYPASSRLS=true`: retire after checking dependencies.
- GitHub PR #4 verified open, unmerged and draft at head `8fbd7b8c1b2d8233bf8a49e57166e8a8eea6db3c`; three PR-triggered workflow runs for that commit reported completed/success. These are not live-Neon tests.

## Required review before ANY write

1. Capture complete column definitions, indexes, constraints, RLS policies, role/object/schema/function privileges, and schema-function definitions from **test branch only**. Compare each with the five migration files, including any manually corrected policies and column defaults. Identify whether baseline and boundaries have already been implemented manually; do not replay them.
2. Check enum definitions, foreign keys, ownership, function `SECURITY DEFINER` permissions and pinned search paths; review all `PUBLIC` grants. Verify runtime role connection endpoints point exclusively to the test branch.
3. Prepare a reviewed, idempotent, **forward-only** schema reconciliation for the missing auth columns, enum types, six tables, indexes, FKs and `security.bootstrap_personal_tenant`. Preserve old objects, synthetic records and RLS; no DROP/RESET/TRUNCATE.
4. Separately create a reviewed Prisma migration-history adoption plan. Check every baseline and M1 object against its committed migration *before* recording any migration as applied. Never mark a migration applied simply because the table exists. Any adjustment to an existing committed migration must go through explicit source-review and migration-history strategy; avoid rewriting shipped history.
5. Explicitly review least-privilege grants for `boxvault_auth_runtime_m1`: needed auth tables, append-only `AuthAuditEvent`, SELECT-only `PlatformOperator`, and EXECUTE-only `security.bootstrap_personal_tenant`. The runtime role must have no direct tenant/content DML. Confirm `boxvault_runtime_m1` cannot read auth secrets or audit.
6. Present actual SQL diff and impact/rollback plan for approval **before** executing any schema, role, migration-history or data changes.
7. After approval: verify connection targeting, apply only to `m1-security-test`; run positive/negative privilege checks with the actual distinct roles and transaction-local RLS; cross-tenant/private ACL denial; verify Prisma drift/migration history.
8. Only after DB gates pass: permit `http://localhost:5173` as a strictly parsed loopback HTTP URL in `NODE_ENV=development` for verification emails; maintain strict HTTPS otherwise; add regression tests.
9. Configure actual reCAPTCHA v3 and Google OAuth locally (not test bypass), then test registration, real Brevo delivery, email verification with recipient-chosen password, password reset, login, MFA/session rotation, and denied replay. Never print secrets.
10. Run CI again on final source SHA, update gate evidence, and keep PR #4 draft.

## Open risks

- The existing schema is nonempty but has no Prisma migration ledger: direct `prisma migrate dev`, `migrate reset`, or replay of baseline is unsafe.
- Current `security.bootstrap_personal_tenant` migration implementation is a `SECURITY DEFINER` function owned by migration role; review its arbitrary UUID parameters, atomicity, RLS behavior, and function grants before exposure.
- Branch-level inspection does not validate the MacBook's working tree, local runtime connection strings or actual email flow; those require local checks.
- Existing `docs/security/m1-security-gate-status.md` describes an older iteration; update status with final SHA after successful live acceptance tests.
