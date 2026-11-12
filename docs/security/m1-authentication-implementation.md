# M1 authentication and MFA implementation — staged code, not production approved

**Date:** 2026-11-11. **PR:** #4 (draft). **Scope:** NestJS API and disposable PostgreSQL CI. This does **not** activate any paid Neon service.

## Implemented server-side foundation

- `POST /api/v1/auth/login` verifies pre-provisioned local-user Argon2id password hashes with a dummy-hash path for unknown accounts. It returns either a short-lived MFA challenge or a BoxVault access token.
- `POST /api/v1/auth/google` validates Google-signed ID tokens server-side against configured web/iOS audiences, issuer and verified email; resolves **immutable Google subject** from `AuthIdentity`. Unknown Google subjects are rejected; no silent merge on matching email.
- `POST /api/v1/auth/providers/google/link` requires an authenticated, recently issued BoxVault session and independently verified Google ID token to link an identity. Existing/duplicated provider links are rejected.
- `POST /api/v1/auth/mfa/totp/setup` creates a pending 30-second standards-compatible 6-digit TOTP factor and returns an `otpauth://` provisioning URI only once under `Cache-Control: no-store`. The secret is AES-256-GCM encrypted at rest using a 32-byte base64 key.
- `POST /api/v1/auth/mfa/totp/confirm` verifies the pending factor, activates it, creates ten cryptographically random one-time HMAC-hashed recovery codes, revokes existing sessions, and requires login again. Codes are shown only at confirmation.
- `POST /api/v1/auth/mfa/challenges/verify` consumes short-lived persisted challenges, enforces an attempt limit, atomic TOTP step replay prevention or one-time recovery-code consumption, then issues a full session.
- Access tokens are signed JWTs (HS256, fixed issuer and audience, 10-minute expiration) with session ID; every protected request rechecks the real session's revocation and expiry using the **separate auth database identity**. A pending MFA challenge is never accepted as a bearer credential.
- Refresh credentials are high-entropy opaque tokens stored **only as a keyed hash**, delivered in Secure (production), HttpOnly, SameSite=Strict cookies with a scoped path. Refresh rotates the stored hash atomically; old refresh values fail.
- `POST /api/v1/auth/logout` revokes the active session.
- `GET /api/v1/containers` and `GET /api/v1/containers/:id` require verified bearer authentication, an authorized tenant UUID, and **transaction-local** RLS context. They do not permit tenant-owner bypass of another member's private container.
- `GET /api/v1/admin/topups` requires a verified bearer token but deliberately denies all identities: platform admin-role/MFA authorization is **not implemented**, and a tenant OWNER is not a platform admin.

## Database and identities

- Added `AuthChallenge` to Prisma, with migration `202611110002_auth_challenges`.
- `AUTH_DATABASE_URL`: isolated DB credential granted only identity/session/MFA tables. Never reuse content-runtime account for auth secrets.
- `DATABASE_URL`: restricted RLS inventory runtime identity, no `BYPASSRLS`, no access to `AuthSession` or `TotpFactor`.
- `DIRECT_URL`: separate migration/admin database credential; never used for requests.
- Required secrets: `AUTH_SESSION_PEPPER` (at least 32 characters), `AUTH_ACCESS_JWT_KEY` (at least 32 characters), and `TOTP_ENCRYPTION_KEY` (base64 encoding of 32 random bytes). Client IDs are needed for Google.
- All secrets must be in a secret manager; no actual passwords/tokens in Git, issues or ChatGPT text.

## Verification

`apps/api/test/authentication.http.contract.test.mjs` tests missing/forged authentication, invalid Google tokens, invalid MFA challenges, reserved admin roles, synthetic Argon2id login, TOTP setup/confirmation, one-time recovery codes, session invalidation, refresh rotation and logout.

`.github/workflows/m1-authorization.yml` provides **two disposable PostgreSQL 18 jobs**:
1. migrations + actual non-BYPASSRLS authorization tests,
2. seeded auth identity + HTTP authentication/MFA lifecycle with separate auth and content roles.

It runs on GitHub Actions, **not Neon**. The workflow tests real Postgres; results should be read from GitHub before claiming PASS.

## Blocking issues before production

This is an implementation milestone, **not complete customer authentication**:

1. **User registration / verified email / password reset / deletion / notification** are not implemented. Password users must currently be provisioned via a controlled process. No real self-service signup is available.
2. Google onboarding for **unlinked** first-time identities is deliberately denied; only previously linked Google IDs can sign in.
3. Application-wide **distributed** IP/account rate limiting, fraud detection, CAPTCHA/reCAPTCHA server verification, token replay protections and anti-enumeration review are required. The current per-process counter is **not** sufficient for multi-instance production.
4. Missing explicit admin identity/role model, mandatory platform-admin MFA and privileged step-up. Admin routes remain denied rather than incorrectly granted.
5. Reuse of a rotated refresh token fails, but device-family token-theft detection / global revocation is not yet implemented.
6. MFA disabling, recovery-code regeneration, factor recovery, step-up after recovery and notifications are incomplete.
7. Google provider-linking requires provider lifecycle auditing; identity/event audit, signing-key rotation and key escrow remain pending.
8. Web/iOS login screens, secure cookie reverse-proxy setup, session UX and accessible CAPTCHA are not implemented.
9. Real authenticated HTTP cross-tenant/ACL/media/QR tests and concurrent RLS/identity race tests still required.
10. Independent review, CI success, versioned schema migration dry-run and production rollback rehearsal are mandatory before merging/deploying.

**Security acceptance:** A passing HTTP contract suite alone does not clear the product for production. Keep PR #4 in draft until all M1 gates, including distributed risk controls and admin MFA, are addressed.

## Free-tier invariant

Neon project `shiny-field-66278071`, organization `org-purple-surf-16785136` remains Free plan. No Neon changes are needed for the disposable GitHub Actions tests; do not provision more Neon branches/computes or switch to a paid plan.
