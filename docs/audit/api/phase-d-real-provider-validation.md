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

## Field execution update — 2026-11-12 (Asia/Manila)

**Evidence classification:** Operator-reported HTTP results, independently corroborated by read-only Neon count/relationship inspection; not a complete successful login test.

| Test | Reported HTTP result | Verification state |
|---|---|---|
| D-01 API health | HTTP 200, `status: ok`, `service: boxvault-api` | PASS, operator-supplied response |
| D-02/D-03 registration with actual reCAPTCHA and API | HTTP 201, `accepted: true` | PASS, operator-reported |
| D-04 Brevo receipt of one-time verification token | Recipient obtained link token and successfully verified | PASS by operator evidence; provider delivery log not inspected |
| D-05 email verification | HTTP 201, `verified: true` | PASS, operator-reported |
| D-06 user and tenant provisioning | Newest user verified, exactly **one** linked tenant membership with role **OWNER**; user count 7, tenant count 3, membership count 6 | PASS, independent Neon read-only query |
| D-07 login | HTTP 401: `Bot verification failed`; no access token issued | **BLOCKED**: CAPTCHA verification rejected; credential/session path not established |
| D-08 verify-email token replay | HTTP 401 | PASS, operator-reported |
| D-09 audit-event content and privacy review | Not inspected | PENDING |

**Preservation reconciliation:** Before integration: users 6 / tenants 2 / memberships 5 / containers 5 / access grants 2 / items 4 / media assets 4. After integration: users **7** / tenants **3** / memberships **6** / containers **5** / access grants **2** / items **4** / media assets **4**. All six Prisma migrations remain applied. Count equality for prior objects is not a bytewise-record integrity proof.

**CAPTCHA diagnosis (source review):** `AuthHardeningService.captcha()` requires Google verification `success=true`, exact `hostname=localhost`, exact `action=login`, numeric `score >= 0.5`, and `challenge_ts` within 120 seconds. The generic HTTP 401 does **not** establish which check failed; login password authentication has not been successfully tested. Do not lower score, bypass CAPTCHA or use `NODE_ENV=test` as a workaround.

**Next controlled action:** Retry a single fresh `login` CAPTCHA from `http://localhost:5173`, immediately submit and capture **status only**; if still rejected, inspect safe server-side diagnostic flags or Google reCAPTCHA admin metrics without storing or sharing raw CAPTCHA tokens. Verify actual login only after CAPTCHA succeeds. Keep PR #4 draft; do not modify production or `dev`.

### Note on historical checklist above

The original matrix above records status when the audit was first created; the dated update here supersedes those pending statuses where an observed result is now available.
