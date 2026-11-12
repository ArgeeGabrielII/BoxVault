# Authentication, Google Sign-In, MFA and Anti-Bot Controls

**Implementation snapshot (2026-11-12; PR #4):** NestJS branch code includes Google ID token validation/linking, Argon2id credentials, verified-email onboarding, password reset, TOTP/recovery codes, session refresh/replay controls, and operator step-up guards. Scoped CI passed on an **earlier** commit; local registration, Brevo verification and login succeeded in the isolated test setting. These are **not** complete client or production acceptance: React/iOS flows, live negative cases, current-head CI and operational safeguards remain. See [API audit](../audit/api/m1-implementation.md), [Phase D](../audit/api/phase-d-real-provider-validation.md) and [roadmap](../planning/delivery-roadmap.md).

Version 0.2 • Status: **approved direction + partial M1 implementation (branch only)**, not deployed/production approved. See [m1-authentication-implementation.md](./m1-authentication-implementation.md) for implementation and verification evidence • 2026-11-11

## Decisions

- **Google Sign-In** is an optional sign-in method alongside email/password, on the web and later native iOS.
- **MFA for customers is optional**, configured per user account, not per tenant. Support TOTP using **Google Authenticator or any standards-compatible authenticator** (Microsoft Authenticator, 1Password, etc.).
- **MFA is mandatory** for platform operators, payment reviewers and security administrators (prefer phishing-resistant passkeys/WebAuthn for privileged roles when available). Require step-up for high-risk actions.
- **Google reCAPTCHA** (or approved equivalent) protects risk-prone **public web** signup/login/reset/contact endpoints, with server verification and risk-based challenges. Do not blanket-challenge every authenticated API request.
- CAPTCHA is **not** an authentication factor, proof of user identity, or a replacement for rate limiting.
- All sign-in methods converge on **the same BoxVault local user ID, per-user MFA policy and tenant authorization pipeline**. Google is an identity provider, not a shortcut around existing MFA, family permissions or the active subscription.
- The **M1 branch** now implements a bounded password/linked-Google/TOTP/session foundation verified with disposable PostgreSQL CI, but no production auth service has been deployed. Missing onboarding, account recovery, CAPTCHA, admin MFA and audit controls remain blocking. No production session may be issued until all release requirements below are implemented and reviewed.

## User flows

1. **Email/password:** verify email/password over TLS → enforce IP/account rate limits and CAPTCHA when required → if TOTP enabled, issue a **short-lived, MFA-only challenge** (not an inventory-capable session) → verify code or recovery code → issue/revoke BoxVault session.
2. **Google Sign-In:** obtain a Google ID token using official Google Identity Services (web) / native SDK (iOS) → send token over TLS to backend → verify Google signature, **issuer, audience, expiry**, and relevant claims → identify account by immutable **Google `sub`** via linked identity → enforce local MFA (if enabled) → issue BoxVault session. Never trust browser-supplied user ID/email without server verification.
3. **First-time Google account:** if no linked identity exists, create a verified account and tenant membership according to onboarding rules; never silently merge an existing password account just because the email matches. Require authenticated, fresh proof of both accounts or a reviewed secure recovery/linking procedure; handle email uniqueness transactionally.
4. **Enable MFA:** user reauthenticates → server generates a cryptographically random TOTP secret → presents one-time provisioning URI/QR over authenticated TLS, with `Cache-Control: no-store` → user confirms a current code → server activates factor and displays **one-time backup codes**. Pending secret expires and cannot be used for login.
5. **TOTP login:** verify configured secret server-side, strict attempts and clock-skew window, **reject reuse of an already accepted time step** (atomic compare/update), then complete a single-use pre-auth challenge. Log only redacted event types.
6. **Recovery or disable MFA:** require current factor or one-time recovery code and fresh reauthentication, notify user, invalidate affected sessions, and apply heightened controls/manual identity verification when all factors are lost. Support cannot casually bypass MFA.
7. **reCAPTCHA:** browser obtains action-scoped token → backend verifies with Google before sensitive action; check success, hostname/action (and expected score for score-based integrations), freshness, uniqueness and optional risk signals. Fail closed on verification failure for protected operations; show accessible fallback/support path.

## Feature requirements

| ID | Scope | Acceptance |
|---|---|---|
| AUTH-01 | Email/password | Argon2id hash, email verification, anti-enumeration, throttling, secure password reset |
| AUTH-02 | Google Sign-In | Google token validation server-side; immutable subject mapping; correct account linking; no client assertion bypass |
| AUTH-03 | Session management | Opaque server-side rotating refresh sessions, httpOnly Secure SameSite cookie where applicable; iOS credentials in Keychain; revocation on logout/user removal; no sessions in localStorage |
| AUTH-04 | TOTP MFA optional for customers | User opt-in, setup challenge, standards-compatible 30-second TOTP, one-time timestep, retries capped, secret encrypted at rest |
| AUTH-05 | Backup/recovery | One-time recovery codes **hashed**, shown only once, revoke on use, secure recovery/disable procedure |
| AUTH-06 | Mandatory privileged MFA | Platform operators must enroll before finance/admin access; sensitive actions prompt step-up |
| AUTH-07 | reCAPTCHA | Public web bot protection, backend verification, replay/hostname/action protections, accessible fallback and IP/account throttling |
| AUTH-08 | Security/account UI | Linked login providers, MFA enrollment/disable, backup-code regeneration, sessions/device listing and logout other sessions |
| AUTH-09 | Identity audit | Events for provider link/unlink, MFA status, recovery, suspicious auth, CAPTCHA fail and session revocation, with no secrets/tokens |
| AUTH-10 | Native iOS | Use Google native SDK or authorization code+PKCE where appropriate, exact bundle ID/config, keychain, enforce same server MFA and permissions |

## API contract (design plus M1 branch implementation; see audit for verified routes)

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/v1/auth/google` | Exchange **verified** Google ID token for provisional MFA challenge or BoxVault session |
| POST | `/api/v1/auth/login` | Password sign-in; may return MFA challenge rather than access |
| POST | `/api/v1/auth/mfa/challenges/verify` | Consume pre-auth challenge and TOTP/recovery code; issue full session |
| POST | `/api/v1/auth/mfa/totp/setup` | Authenticated + step-up: start pending enrollment |
| POST | `/api/v1/auth/mfa/totp/confirm` | Activate factor after successful confirmation; return recovery codes once |
| POST | `/api/v1/auth/mfa/disable` | Authenticated + fresh factor proof; revoke sessions and notify |
| POST | `/api/v1/auth/mfa/recovery-codes/rotate` | Fresh factor proof, invalidate prior codes |
| GET | `/api/v1/auth/providers` | List account-linked providers (authenticated) |
| POST | `/api/v1/auth/providers/google/link` | Fresh local auth and verified Google identity; prevent cross-user link |
| DELETE | `/api/v1/auth/providers/google` | Fresh auth; prevent removing last viable sign-in method |
| GET/DELETE | `/api/v1/auth/sessions` | List and selectively revoke user sessions |
| POST | `/api/v1/auth/logout` | Revoke active session/refresh token |
| POST | `/api/v1/security/captcha/verify` | **Optional** challenge UX endpoint; server must independently verify token during protected operation |

Success/error contracts: never return TOTP secrets after activation, never return raw recovery codes twice, do not disclose whether an email/account exists, include correlation ID and generic rate-limit errors. Auth challenge tokens must be single-purpose, short-lived, single-use and cannot access tenant data. Idempotency/transactions required for first-time account and provider-link creation.

## Data model foundation

The Prisma schema introduces (a) nullable `User.passwordHash` for Google-only accounts; (b) `AuthIdentity` with unique provider/provider-subject and user/provider mapping; (c) `TotpFactor` with encrypted secret ciphertext, optional pending enrollment expiry and last-used step; (d) hashed `MfaRecoveryCode`; and (e) `AuthSession` with **hashed** refresh token reference, revocation, expiry and MFA timestamp. **A migration is required before deploying this schema**, and application services must enforce all listed invariants and database tenant isolation. Do not store raw Google tokens, TOTP secrets, backup codes or CAPTCHA secrets in these tables/logs.

## Environment/configuration (never commit secrets)

Web public: `VITE_GOOGLE_CLIENT_ID`, `VITE_RECAPTCHA_SITE_KEY` (public identifiers only).
API private: `GOOGLE_WEB_CLIENT_ID`, optional `GOOGLE_IOS_CLIENT_ID`, `RECAPTCHA_SECRET_KEY`, `TOTP_ENCRYPTION_KEY`, `AUTH_SESSION_PEPPER`. Use secret manager/protected deployment environment. Do not enable auth routes if secrets or server-side validation are missing.

Google Cloud: register authorized JavaScript origins and redirect URIs/bundle ID as needed; configure verified domains and consent screen appropriately. Configure reCAPTCHA key for the exact web domains and backend verification. Rotate keys with audit and procedures.

## Security release tests (blocking)

- [ ] Forged, expired, wrong-audience, wrong-issuer Google ID tokens denied.
- [ ] Same email but unrelated Google subject cannot silently take over local account.
- [ ] Disconnected OAuth account cannot sign in; linking/unlinking requires reauthentication.
- [ ] Google login cannot bypass TOTP or tenant authorization.
- [ ] Pending MFA challenges cannot call any inventory, finance or family APIs.
- [ ] Reused TOTP step, reused backup code and replayed challenge rejected under concurrency.
- [ ] MFA reset/disable requires strong verification and revokes sessions.
- [ ] Unenrolled operator cannot open admin/financial actions; privileged actions require MFA.
- [ ] CAPTCHA tokens missing/invalid/expired/replayed/wrong-host/wrong-action denied on protected routes.
- [ ] Rate limits continue to protect authentication when CAPTCHA provider is unavailable.
- [ ] Secrets and tokens absent from logs, URLs, telemetry, backups accessible to operators, frontend bundles and documentation.
- [ ] Web and iOS sign-in, accessibility and account recovery tested.
- [ ] Database migration and rollback reviewed, secret rotation runbook ready, dependency scans pass.

## Implementation sequence

1. Add migrations + user/provider/session repositories and secure cookie/token infrastructure.
2. Implement verified Google sign-in and password flow with common MFA gate.
3. Add TOTP enrollment, single-use challenge and recovery-code safeguards.
4. Integrate web/iOS UI; risk-sensitive CAPTCHA + server checks.
5. Complete audit, operator step-up, negative tests and independent security review.

References: Google Identity backend verification (https://developers.google.com/identity/sign-in/web/backend-auth); Google reCAPTCHA server verification (https://developers.google.com/recaptcha/docs/verify); OWASP MFA Cheat Sheet (https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html).
