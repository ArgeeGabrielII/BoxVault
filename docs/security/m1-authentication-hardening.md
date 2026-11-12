# Milestone 1 — Authentication hardening and release requirements

**Date:** 2026-11-11 · **Status:** IMPLEMENTED IN DRAFT PR #4, **NOT production-approved**. See [m1-security-gate-status.md](m1-security-gate-status.md) for actual CI evidence, not planned outcomes.

## Delivered backend controls

### Account onboarding and recovery

- `POST /api/v1/auth/register`: validates candidate email and password; applies per-IP/account database throttling and server-verified CAPTCHA. Stores an unverified identity, sends a 30-minute single-use email verification token through configured authenticated SMTP, and returns a generic `{accepted:true}` result.
- `POST /api/v1/auth/verify-email`: validates the hashed, expiring, single-use token **and a newly chosen password from the email recipient**, preventing an attacker from pre-registering a victim's email with attacker-known credentials. Updates verified-email state and uses tightly scoped `security.bootstrap_personal_tenant` to create exactly one new private personal tenant. The function serializes per-user onboarding and is executable only by the auth service role.
- `POST /api/v1/auth/password-reset/request`: CAPTCHA and throttling, generic response regardless of whether the email exists; email contains a 15-minute single-use opaque reset token.
- `POST /api/v1/auth/password-reset/confirm`: validates the token and new password, uses Argon2id, consumes all outstanding reset links and revokes every active session.
- Email tokens are stored only as keyed SHA-256 HMACs, never plaintext. Test delivery uses local SMTP sink only; no messages leave CI.
- SMTP delivery errors are recorded without secrets; API returns generic acceptance to limit account enumeration. **A durable email delivery/outbox service, retry alarm and availability monitoring remain operational release requirements.**

### CAPTCHA and distributed abuse throttling

- `AuthHardeningService` verifies reCAPTCHA v3 server-side over TLS against the configured Google siteverify endpoint, requiring success, exact hostname, action, minimum score 0.5, 2-minute challenge freshness and one-time use tracked atomically in PostgreSQL.
- Provider downtime fails closed. Only `NODE_ENV=test` together with explicitly configured `AUTH_BOT_PROTECTION_MODE=off` bypasses the provider, for disposable CI testing.
- `AuthRateLimit` is shared across processes via atomic PostgreSQL upserts, keyed by HMAC rather than raw IP/email values. Normal sign-in is capped at 10/minute; signup/reset are capped at 5/hour; sensitive MFA/step-up actions are capped at 5/10 minutes. **Edge/WAF admission control, trusted reverse-proxy IP handling, scheduled retention cleanup and accessible CAPTCHA fallback remain required** for public-scale production.

### Administrator MFA, recovery and sessions

- `PlatformOperator` is separate from family roles. Roles: `PAYMENT_REVIEWER`, `OPERATIONS_ADMIN`, `SECURITY_ADMIN`. `enabled` defaults to false; customers cannot enroll themselves as platform administrators.
- An enabled operator cannot sign in without an enrolled TOTP factor. `POST /auth/step-up` requires a **new** TOTP time-step and updates a separate per-session privileged step-up timestamp; a new signed access JWT includes a matching step-up claim.
- Payment reviewer guard checks explicit role, enabled status, verified email, active TOTP factor and a matching recent step-up claim. **Old signed access tokens do not inherit step-up**, and refresh clears step-up.
- `GET /admin/topups` returns `501` even after successful authorization because the actual payment review service is not yet released. An unauthorized user always receives `401` or `403`.
- `POST /auth/mfa/disable` requires active authentication, password reauthentication and TOTP/recovery proof. Enabled platform operators cannot disable mandatory MFA.
- `POST /auth/mfa/recovery-codes/rotate` invalidates old recovery codes and active sessions and displays fresh one-time codes.
- `GET /auth/sessions`, `DELETE /auth/sessions/:id`, `POST /auth/sessions/revoke-others` support account session visibility/revocation.
- Every rotated refresh token's **keyed hash** is retained until its session expiry. Replaying it revokes that user's active sessions. Distinct content and auth database credentials prevent the inventory API from reading identity secrets.

### Audit

- `AuthAuditEvent` records security event kinds, timestamp and optional actor user UUID; no token/email, user-supplied payload, raw IP or TOTP secret is persisted.
- Auth identity database role can append (and read limited security history), but **cannot UPDATE/DELETE audit events**. Content runtime role has no audit-table access.
- `GET /auth/security/events` returns up to 50 of the authenticated user's own events, with `Cache-Control: no-store`.
- Dedicated immutable external log archiving/retention, alerting and incident response exercises remain operational release requirements.

## Private API configuration

Set these environment variables via protected deployment secrets, never Git, web frontend bundles or screenshots:

| Variable | Purpose |
|---|---|
| `AUTH_DATABASE_URL` | Auth-role connection; user/identity/session/challenge/action-token/audit/rate tables, read-only operator table; restricted SQL bootstrap EXECUTE |
| `DATABASE_URL` | Pooled non-BYPASSRLS tenant-content user, no authentication table access |
| `DIRECT_URL` | Separate migration/admin DB role; never used for client requests |
| `AUTH_SESSION_PEPPER` | High-entropy HMAC pepper (at least 32 chars) |
| `AUTH_ACCESS_JWT_KEY` | High-entropy 32+ character signing key; rotate with session invalidation |
| `TOTP_ENCRYPTION_KEY` | Base64-encoded 32-byte AES-256-GCM key, backed up securely |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | TLS-required SMTP delivery |
| `PUBLIC_WEB_URL` | Exact HTTPS origin for email activation/reset links |
| `RECAPTCHA_SECRET_KEY`, `RECAPTCHA_HOSTNAME` | Verified server-side v3 reCAPTCHA on web sign-in/signup/reset |
| `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID` | Google token audience verification |
| `WEB_ORIGIN` | Exact permitted web origins, never a wildcard |
| `NODE_ENV` | Must be `production` in deployment; do not enable test-only bypass |

**Operator provisioning:** a trusted database administrator, **not any tenant owner**, must independently review account identity, TOTP enrollment and the assigned platform role before enabling a `PlatformOperator` record. Prefer dual approval for payment-review privileges. App-layer admin handlers may never assign or change operator roles.

**Do not copy CI-only SMTP/CAPTCHA/token pepper values into live hosting.** Initial operator admin endpoints intentionally cannot return payment proof, account content or customer inventory.

## CI and evidence

- `.github/workflows/m1-authorization.yml` starts disposable PostgreSQL 18 and applies all committed Prisma migrations; performs drift check and SEC-00 through SEC-10.
- A separate disposable Postgres job builds the API, uses a synthetic identity and local-only SMTP sink to test unverified login denial, single-use email verification, personal tenant provisioning, password-reset replay, session revocation, TOTP enrollment, one-time backup codes, operator privilege gating, fresh step-up JWT enforcement and rotated-refresh replay.
- `apps/api/test/captcha.integration.test.mjs` verifies CAPTCHA success, replay denial, wrong hostname/action, low scores, expired challenges and provider outage behavior. All tests use synthetic credentials.
- The latest CI status should be checked on PR #4; **never infer PASS merely from committed workflow files**.

## Security and product blockers

1. Production SMTP provider account, DNS/SPF/DKIM/DMARC and bounce/delivery monitoring, outbox retry and incident recovery.
2. Production reCAPTCHA site key/secret/registered domains, real Google OAuth clients and live provider integration checks; accessible CAPTCHA fallback.
3. User-facing React onboarding, verify-email/password setup, recovery, Google linking, MFA enrollment and account/session management; iOS account flow and Keychain.
4. Scalable edge DDoS/WAF protection, trusted proxy setup, rate-limit cleanup and load tests; CORS/cookie/CSRF threat-model verification.
5. Independent operator provisioning policy, privileged MFA step-up test with real administration infrastructure and authorization of future payment review actions.
6. Tamper-evident centralized audit export, alerting, log retention/deletion policy, backups and recovery exercises.
7. Password compromises, email reassignment, lost-factor support recovery, token/key rotation, account deletion and independent pen-test assessment.
8. Full QR/media/financial authorization E2E tests, concurrent grants and tenancy races, privacy/regulatory review, mandatory branch protection, deployment secrets and rollback drill.

**Neon free-tier hard constraint:** no Neon plan changes, extra compute, branches or paid services. The CI suite uses GitHub's disposable PostgreSQL, not Neon. The default Neon `dev` branch is not migrated by this work.
