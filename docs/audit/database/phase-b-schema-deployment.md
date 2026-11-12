# Database — Phase B: M1 authentication schema deployment

**Date:** 2026-11-12 (Asia/Manila)  
**Status:** VERIFIED on `m1-security-test`  
**Branch:** `br-fragrant-salad-b3ntdaa0` (`m1-security-test`), Neon project `shiny-field-66278071`  
**Execution:** Authorized by operator; local Prisma CLI using direct migration role `neondb_owner`.  
**Excluded:** Neon default `dev`, grants, app deployment and PR merge.

## Preconditions

- Operator verified feature branch `feat/m1-auth-tenant-acl-rls`, Prisma schema valid, six migration files present and migration files unchanged in the tracked diff.
- Local `DIRECT_URL` guard compared the expected direct test-branch hostname, database `neondb`, non-pooler mode and migration role `neondb_owner`. Credentials were not printed.
- Live ledger contained precisely two finished migrations (`000`, `001`), and `002`–`005` were pending.
- Pre-deployment user/inventory counts recorded below. This is **schema deployment with data preservation**, not a claim that a tested restore point exists.

## Executed migrations

| Migration | Technical changes | Outcome |
|---|---|---|
| `202611110002_auth_challenges` | `AuthChallenge` for short-lived MFA verification | Applied |
| `202611110003_auth_recovery_hardening` | Email action tokens, distributed rate limiting, auth audit, platform operator metadata, verification/step-up columns, bootstrap precursor | Applied |
| `202611110004_refresh_replay` | `RefreshTokenReuse` keyed hashes for replay detection | Applied |
| `202611110005_token_bound_onboarding` | Replaces arbitrary UUID bootstrap function with `security.bootstrap_verified_email_tenant(text,uuid,uuid)` | Applied |

**Operator evidence:** `pnpm exec prisma migrate deploy --schema prisma/schema.prisma` reported all four migrations successfully applied; subsequent `prisma migrate status` reported `Database schema is up to date!`.

**Independent read-only Neon checks:** all six Prisma ledger records finished, zero rolled back or unfinished; all six added auth tables present; columns `User.emailVerifiedAt` and `AuthSession.privilegedStepUpAt` present; new bootstrap function owned by `neondb_owner`, `SECURITY DEFINER` true, `search_path=pg_catalog`.

## Data preservation

| Object | Before | After | Outcome |
|---|---:|---:|---|
| `User` | 6 | 6 | Preserved |
| `Tenant` | 2 | 2 | Preserved |
| `TenantMember` | 5 | 5 | Preserved |
| `Container` | 5 | 5 | Preserved |
| `ContainerAccessGrant` | 2 | 2 | Preserved |
| `Item` | 4 | 4 | Preserved |
| `MediaAsset` | 4 | 4 | Preserved |

All ten inspected tenant/inventory/finance tables retained RLS `ENABLE` and `FORCE`. Table counts establish preservation by count, not byte-for-byte equivalence.

## Security boundary and next gate

Immediately after Phase B, the new function was **not executable** by `boxvault_auth_runtime_m1`, `boxvault_runtime_m1`, or `PUBLIC`. No application privileges were granted during this phase. See [Phase C](phase-c-identity-grants.md).

**Release status:** Schema completed on isolated Neon test branch; live end-to-end onboarding still pending.
