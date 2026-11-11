# M1 — Authentication, Tenant Membership, Container ACL, PostgreSQL RLS

**Status:** implementation in progress; **not approved for production**. Branch: `feat/m1-auth-tenant-acl-rls`.

## Approved authentication policy
- Personal and Family users: **optional** authenticator-app MFA (TOTP / Google Authenticator compatible).
- Admin, payment reviewer and financial privileged roles: **mandatory MFA**; sensitive operations require step-up.
- Google Sign-In is optional, verified server-side, and **does not bypass** BoxVault MFA.
- Passkeys/WebAuthn: future milestone, prioritized for phishing-resistant privileged authentication.
- CAPTCHA is abuse mitigation, not a sign-in factor.

## M1 gates
1. Verified Google and password sign-in, MFA pre-auth challenges, secure rotating sessions.
2. Tenant membership with active status, atomic four-seat cap and verified ownership.
3. Containers created PRIVATE by default; member grants or ALL_FAMILY explicitly selected.
4. Every request authenticates and resolves an active tenant membership before operating.
5. All customer-content queries run under transaction-local user/tenant RLS context.
6. Cross-tenant, sibling-private, revoked, and QR-label bypass tests pass using the *runtime* DB identity.
7. Dedicated runtime/migration DB roles: runtime does not own tables, has no BYPASSRLS and cannot SET ROLE to privileged identities.
8. Backfill/migration, rollback and monitoring rehearsed; security reviewer signs off.

## Current delivery scope
- Added Prisma model changes for member status, private container ownership/sharing and ACL grants.
- Added draft SQL RLS policy/migration. **Migration intentionally fails when prior containers lack a validated owner.**
- This is an **unapplied candidate migration**: schema baseline, role provisioning, security-definer ownership, GRANT/REVOKE and SQL integration tests are needed before deployment.
- No protected inventory API is exposed by this milestone until auth + membership + ACL + RLS enforcement is complete.

## Invariants
- A tenant OWNER **does not** automatically see a sibling's private boxes.
- An EDITOR cannot widen another member's sharing; sharing manager currently = box creator only.
- SELECTED_MEMBERS grants are constrained by both member role and grant permission.
- ALL_FAMILY access is constrained by active tenant membership.
- A QR token never authorizes access; it is only a locator.
- Tenant switching takes effect only after verified membership; never trust arbitrary request tenant/user claims.
- RLS session context must be set in the **same SQL transaction** as each data query via `set_config(..., true)`; no pooled session state.
- Private customer content is not queryable through administrative roles or admin endpoints.

## Work remaining before first security milestone can be marked done
- Auth controller/service, Google credential verification, Argon2id, TOTP and recovery service.
- Opaque refresh rotation, auth guards, membership and admin policy guards.
- Container service with checked ACL writes, membership revocation and audit events.
- Install migration in a disposable PostgreSQL instance and verify runtime role.
- End-to-end negative tests, including same-family members with different grants and concurrent changes.
- Web and iOS UX, CAPTCHA server verification, operational secrets and phishing-resistant passkey roadmap.

Related: [authentication-google-mfa-captcha.md](authentication-google-mfa-captcha.md), [family-sharing-access-control.md](family-sharing-access-control.md), [security-release-checklist.md](security-release-checklist.md).

## Database authorization E2E test
See [critical-authorization-e2e-tests.md](critical-authorization-e2e-tests.md). Real database test is written but **not yet executed or passed**; HTTP and authentication E2E remain future work.
