# API — Phase D: Real Brevo / reCAPTCHA signup verification

**Date opened:** 2026-11-12 (Asia/Manila)  
**Status:** PENDING; **no live registration verified yet**  
**Application:** local NestJS API (`apps/api`) using restricted Neon identities.  
**Database:** `m1-security-test` exclusively.  
**Change authorization:** Phase B schema deployment and Phase C grants have separate explicit approvals. Phase D live registration has not been executed in the recorded evidence.

## Goal

Validate self-service registration using a **real** reCAPTCHA v3 browser-issued token, Brevo delivery of an email verification link, atomic token-bound personal-tenant creation, login, and replay denial.

## Required configuration, without exposing secrets

- `NODE_ENV=development` (do **not** use `test` mode or disable CAPTCHA).
- `DATABASE_URL` authenticates as `boxvault_runtime_m1` (pooled test-branch endpoint).
- `AUTH_DATABASE_URL` authenticates as `boxvault_auth_runtime_m1` (pooled test-branch endpoint).
- `DIRECT_URL` points only to migration owner on **direct** test-branch endpoint; do not use it as the API runtime credential.
- Brevo SMTP hostname, sender, credentials are configured privately. The sender address must be a verified sender/domain.
- `RECAPTCHA_SECRET_KEY` and `RECAPTCHA_HOSTNAME=localhost` are configured; a matching public v3 site key is installed in a **local-only** browser test harness/UI.
- `PUBLIC_WEB_URL=http://localhost:5173` is allowed only in local development following the mailer fix; production/non-loopback URLs must be HTTPS.
- Never paste email tokens, passwords, full SMTP logs, private URLs or CAPTCHA secrets into source control.

## Expected sequence and evidence to capture

| Step | Expected behavior | Observed | Status |
|---|---|---|---|
| D-01 | API starts and `GET /api/v1/health` responds successfully | No operator result yet | PENDING |
| D-02 | Genuine `register` reCAPTCHA v3 token accepted | No operator result yet | PENDING |
| D-03 | `POST /api/v1/auth/register` returns `{accepted:true}` without enumeration | No operator result yet | PENDING |
| D-04 | Brevo delivers token to a dedicated test inbox | No verified delivery evidence yet | PENDING |
| D-05 | `POST /api/v1/auth/verify-email` consumes token and returns `{verified:true}` | No operator result yet | PENDING |
| D-06 | Exactly one new personal tenant and OWNER membership; no changes to existing fixtures | No operator result yet | PENDING |
| D-07 | Verified login with fresh `login` CAPTCHA; unverified login denied | No operator result yet | PENDING |
| D-08 | Replayed/expired/wrong-kind email token denied | CI covered similar cases; live result pending | PENDING |
| D-09 | Account security event metadata contains no credential material | No operator result yet | PENDING |

## Preservation expectations

Before registration, isolated test branch: **6 users, 2 tenants, 5 memberships, 5 containers, 2 grants, 4 items and 4 media**. A successful **single new** registration should normally add one user, one personal tenant and one owner membership, while the original fixture records remain intact. Count changes alone are insufficient to prove record-level integrity.

## Blockers and next gate

- Web app remains a starter; there is no built-in registration/reCAPTCHA flow. A local-only test interface is needed.
- Validate local env configuration without printing values, then build and run API.
- Manual authorization required before any destructive cleanup of a synthetic signup.
- Confirm successful real-provider result before declaring end-to-end authentication acceptance.

**Sign-off:** Not yet granted; live provider and authorization test evidence pending.
