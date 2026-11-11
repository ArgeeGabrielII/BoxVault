# Milestone 1 — security acceptance gates and execution state

**Date:** 2026-11-11. **Branch:** `feat/m1-auth-tenant-acl-rls`; **PR:** #4, draft.

**Do not merge, deploy for paying customers, or mark M1 complete until every required gate has independently verified evidence.** Test code existing is not evidence that tests passed.

## Changes in this iteration

1. Confirmed the repo already includes a **versioned** baseline SQL file `apps/api/prisma/migrations/202611110000_baseline/migration.sql`, generated from the original Prisma schema. Kept it; did not create a duplicate migration.
2. Updated `.github/workflows/m1-authorization.yml` to use `prisma migrate deploy` for **both committed migrations**, confirm `_prisma_migrations` contains two successful entries, and perform `prisma migrate diff --exit-code` to detect structural drift. Replaced the temporary baseline SQL generation.
3. Added `apps/api/test/authentication.http.contract.test.mjs`, runnable with `pnpm --filter @boxvault/api test:auth-http:contract` and `BOXVAULT_API_URL`. HTTP checks require actual endpoint behavior; a missing route returning 404 **fails**, rather than passing as a protected endpoint.
4. Added the **independent** `auth-http-contract` CI job. It builds and starts the NestJS API and runs the contract tests. It is *expected red* while the documented routes are not implemented.
5. No Neon resource changes. No secrets, project credentials, new Neon branch, plan upgrade, or paid Neon service.

## Acceptance gates

| Gate | Definition of pass | Status |
|---|---|---|
| DB-01 | All three versioned Prisma migrations apply cleanly on a fresh disposable PostgreSQL instance and are recorded | **PASS in GitHub Actions (2026-11-11, commit c91f7a9)** |
| DB-02 | Prisma schema-vs-database diff reports no drift | **PASS in GitHub Actions (2026-11-11, commit c91f7a9)** |
| RLS-01 | SEC-00..SEC-10 pass using distinct fixture and **non-BYPASSRLS** content runtime database identities | **PASS in GitHub Actions (2026-11-11, commit c91f7a9)**; earlier manual Neon SQL policy probes also passed |
| RLS-02 | Removed member cannot read historical `ContainerAccessGrant`, sibling-private content, or child media; unauthorized tenant switch denied | **PASS in PostgreSQL CI and verified manually on isolated Neon test branch** |
| AUTH-01 | Email/password Argon2id, verified Google token (sub/aud/iss/exp), account linking, secure session issuance/rotation, anti-enumeration | **Partially implemented: core password/Google + sessions, missing onboarding, recovery, captcha, production hardening** |
| AUTH-02 | Optional TOTP with one-time recovery codes and challenge-gated session issuance; mandatory privileged MFA and step-up | **Partially implemented: customer TOTP, one-time recovery and challenges passed HTTP CI; platform-admin MFA/step-up not implemented** |
| HTTP-01 | Real API returns 401 for missing/forged authentication before tenant/inventory access; invalid Google/MFA challenges denied | **PASS in GitHub Actions (2026-11-11, commit c91f7a9)** |
| HTTP-02 | Authenticated cross-tenant/ACL/QR/media negative and positive cases pass through real NestJS controllers | **Partially implemented: authenticated container reads; positive multi-tenant HTTP scenarios pending** |
| OPS-01 | Security tests required by branch protection; review of credentials/roles and policies; safe migration/rollback | **Needs repository administration and security review** |

## CI execution evidence

All three GitHub Actions checks at commit `c91f7a9` completed successfully on 2026-11-11:

- General TypeScript CI — **PASS**.
- PostgreSQL M1 authorization gate (real disposable PostgreSQL 18 migrations, RLS, SEC-00..SEC-10) — **PASS**.
- Auth HTTP contract (real disposable PostgreSQL 18 with separate auth/content database roles and synthetic Argon2id user; verifies password login, TOTP enrollment, recovery code, refresh rotation and logout) — **PASS**.

The HTML/HTTP integration suite does **not** prove production readiness: live Google OAuth cannot be tested without an authorized sandbox client ID and real provider flow; no self-service registration, email verification, password reset, persistent distributed rate limiting, abuse protection, platform-admin MFA or full media/QR handlers exist yet.

Security tests are now **passing for the scoped M1 implementation**. Branch protection, independent review and remaining production requirements are **still blockers**. Retest after any further source changes.

## Authentication build order

1. Implement separate restricted DB identities for auth/session repositories and tenant-content queries. The content runtime role must not read `AuthSession` or `TotpFactor`.
2. Implement password and Google login with verified identities and short-lived **pre-MFA challenges** that cannot access tenant data.
3. Implement session rotation, revocation, CSRF protection for cookie auth, and MFA/recovery-code replay prevention.
4. Implement guarded NestJS tenant/container routes and per-container ACL enforcement on the server, plus RLS transaction context.
5. Wire account/member/MFA web UI, accessible reCAPTCHA server checks, and mandatory admin MFA.
6. Run HTTP and database integration tests, threat-model review, audit/log leakage checks, and an independent security review.

A previous internal prototype `TenantBoundaryService` reads `AuthSession` through its content Prisma client. **Do not wire it into HTTP routes as-is**: the runtime role intentionally lacks permission to read auth tables. Split auth/session validation into a distinct least-privilege auth repository or credential-verification service, then pass only a verified principal to content RLS transactions. Never use refresh-token credentials as API access tokens.

## Free-tier guard

Neon organization `org-purple-surf-16785136`, project `shiny-field-66278071`: remain on `free_v3`. Reuse existing two branches and do not enable paid extensions/add-ons, provision extra always-on compute, or change plan. GitHub Actions disposable PostgreSQL avoids spending Neon compute hours on repeated RLS tests.

**Acceptance rule:** A green SQL RLS proof alone does not authorize a user-facing SaaS launch.

## Internal boundary correction

Replaced the prototype's refresh-token database lookup in `TenantBoundaryService` with a `VerifiedPrincipal` input. The **content runtime role is never granted access to auth/MFA tables**. A future authenticated access-token guard and separate auth-service identity must issue and validate that principal; TypeScript structure alone is not an authorization credential. See `apps/api/src/security/README.md`.

## Prisma relation consistency

The canonical M1 Prisma schema now explicitly models the three composite tenant-membership foreign keys already present in the SQL migration: container owner membership, ACL grantee membership, and ACL grantor membership. Their SQL constraint names are preserved via `map`. This allows the migration drift gate to compare relationship constraints, not just tables. **Prisma validation and drift comparison are still pending CI execution.**

The API contract test follows the existing documented routes: `/api/v1/containers`, `/api/v1/containers/:id`, `/api/v1/admin/topups`, `/api/v1/auth/login`, `/api/v1/auth/google` and `/api/v1/auth/mfa/challenges/verify`. The latter two are specified in the Google/MFA design, not yet wired.

**Latest verification check:** no successful workflow run was returned for the current PR head, and PR #4 remains draft; no claims of successful end-to-end tests. The pull request's branch conflict was subsequently resolved without merging into main; CI results and security acceptance remain outstanding.

## Main-branch reconciliation

Merged the latest `main` into the M1 **feature branch only**, preserving its Neon agent skills, project OAuth MCP configuration, non-secret env examples, and `docs/neon-connection.md`, while retaining the updated M1 Prisma/ACL/RLS schema. The `docs/README.md` index includes both Neon and security-gate documentation. GitHub now reports PR #4 as **mergeable**, but it remains **draft/unapproved** and has not been merged into `main`. No Neon cloud resources were changed by the Git merge.

## Auth implementation follow-up (2026-11-11)

The actual NestJS authentication and MFA service is present in `apps/api/src/auth/`. See [m1-authentication-implementation.md](m1-authentication-implementation.md) for endpoint behavior and every remaining hardening gap. Google sign-in is verified for already-linked identities; first-time Google onboarding remains denied until securely implemented. Admin endpoints are fail-closed with mandatory future role/MFA enforcement.

The free-tier invariant remains mandatory. Both CI jobs use disposable PostgreSQL service containers on GitHub Actions; the persistent Neon default `dev` branch is untouched.
