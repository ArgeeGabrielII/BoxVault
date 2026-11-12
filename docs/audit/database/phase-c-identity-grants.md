# Database — Phase C: Restricted authentication grants

**Date:** 2026-11-12 (Asia/Manila)  
**Status:** VERIFIED on `m1-security-test`  
**Authorization:** User explicitly approved only five reviewed GRANT statements.  
**Scope:** Neon `shiny-field-66278071`, branch `br-fragrant-salad-b3ntdaa0`, database `neondb`, executing role `neondb_owner`.  
**Out of scope:** default `dev`, legacy role changes, API deployment, user registration, PR merge.

## Preflight

The restricted `boxvault_auth_runtime_m1` role had no parent-role memberships, `BYPASSRLS=false`, no role/database creation, no `CREATE` on `public` or `security`, and no auth-table DML. The inventory runtime `boxvault_runtime_m1` could not query auth data or execute the new onboarding function. The function had `PUBLIC` EXECUTE revoked.

## Authorized and completed change

The following grant groups ran **inside one Neon SQL transaction** (five statements; all returned successfully):

1. `SELECT, INSERT, UPDATE, DELETE` on `User`, `AuthIdentity`, `AuthSession`, `AuthChallenge`, `TotpFactor`, `MfaRecoveryCode`, `EmailActionToken`, `AuthRateLimit` and `RefreshTokenReuse`, to `boxvault_auth_runtime_m1`.
2. `SELECT, INSERT` only on `AuthAuditEvent` (append-only at table-privilege level).
3. `SELECT` only on `PlatformOperator`.
4. `USAGE` on `security` schema.
5. `EXECUTE` on only `security.bootstrap_verified_email_tenant(text,uuid,uuid)`.

No additional grants or revoked permissions were part of the approved operation.

## Post-change negative and positive privilege checks

| Assertion | Live result |
|---|---|
| Authentication role has intended CRUD on nine authentication tables | PASS |
| `AuthAuditEvent`: auth role can SELECT and INSERT, **cannot** UPDATE or DELETE | PASS |
| `PlatformOperator`: auth role can SELECT, **cannot** INSERT/UPDATE/DELETE | PASS |
| Authentication role can execute token-bound onboarding function | PASS |
| Inventory role cannot execute onboarding function | PASS |
| `PUBLIC` cannot execute onboarding function | PASS |
| Inventory runtime cannot SELECT auth tables | PASS |
| Auth role cannot SELECT containers, subscriptions, wallets, plans; cannot INSERT tenant membership or UPDATE topups | PASS |
| Both runtime roles have `BYPASSRLS=false`, no inherited roles, no CREATE ROLE/DB | PASS |

These are **effective PostgreSQL privilege inspections**, not proof of complete runtime registration flows.

## Preservation check

Before and after privileges: **6 users, 2 tenants, 5 memberships, 5 containers, 2 access grants, 4 items, 4 media**. Six migrations completed, zero unfinished/rolled back.

## Open risk

The legacy `boxvault_auth_m1` role still has unsafe privileged capabilities (`BYPASSRLS`, role/database creation, inherited elevated membership). **It was not used or modified.** Retire or restrict it only after explicit dependency review and separate approval.

**Release decision:** Phase C DB permissions complete; [Phase D](../api/phase-d-real-provider-validation.md) not yet verified.
