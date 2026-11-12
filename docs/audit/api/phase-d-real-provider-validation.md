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

## Follow-up — repeated login CAPTCHA rejection (2026-11-12, Asia/Manila)

Operator confirmed receipt of a second Brevo verification message and completion of email verification. Subsequent local tester login again returned HTTP **401** with generic `Bot verification failed`; no session or access token was issued. This remains a **CAPTCHA-blocked login**, not a proven credential failure.

**Diagnostic improvement:** commit [`775a764`](https://github.com/ArgeeGabrielII/BoxVault/commit/775a7649b6c1e8d917c58f97a5eeffcf8b1f7f69) adds `NODE_ENV=development`-only *reason-code* warnings to the NestJS server when Google CAPTCHA verification denies a request. Reason codes differentiate provider failure, host/action mismatch, missing/low score and invalid or stale challenge timestamp. Existing user-facing 401 responses and the minimum score of 0.5 remain unchanged. No raw CAPTCHA tokens, provider payload, keys, user identifiers, or timestamps are logged by this change.

**Next evidence needed:** pull code, restart local API, perform a single fresh login with live `login` reCAPTCHA token, and record only the reason code(s) from the server warning. If Google returned a low score, review the score-based reCAPTCHA admin metrics and local test characteristics rather than disabling verification. No independent production login evidence or runtime API deployment is claimed.

## Successful verified login — 2026-11-12 (Asia/Manila)

**Evidence:** Operator-reported local mock-browser login response; independent read-only audit-event inspection on Neon `m1-security-test`.

| Check | Observed result | Evidence classification |
|---|---|---|
| `POST /api/v1/auth/login` | HTTP **201** | Operator-reported |
| Live reCAPTCHA v3 `login` challenge | Passed API acceptance path | Inferred from success with CAPTCHA enforcement enabled; no token retained |
| Account MFA challenge | `mfaRequired: false` | Operator-reported |
| Bearer access token | Issued, not displayed or saved by mock UI | Operator-reported |
| Login audit event | `LOGIN_SUCCEEDED` at **2026-11-12T04:23:14.740Z** (12:23:14 Asia/Manila) | Independently verified from `AuthAuditEvent` |
| Earlier events | `REGISTERED` at 04:22:37 UTC and `EMAIL_VERIFIED` at 04:23:04 UTC | Independently verified by kind/time; user-specific linkage not inspected in this check |
| Preservation | 9 users, 5 tenants, 8 memberships, 5 containers, 2 access grants, 4 items, 4 media assets, six applied migrations | Independent read-only Neon aggregate counts |

**Interpretation:** Phase D baseline register → email verification → login now succeeds against the local API and isolated test database. Multiple synthetic sign-ups occurred after the initial preservation baseline (6 users / 2 tenants / 5 memberships); the latest counts are therefore **9 / 5 / 8**. Original inventory row counts remain unchanged. This is not a claim of full record-level parity, MFA recovery testing, refresh rotation, cross-tenant authorization acceptance, or production readiness.

**Remaining work:** Confirm authenticated `GET /api/v1/containers` using the newly minted bearer token without displaying/storing it; run fresh CAPTCHA and anti-replay negative checks where needed; confirm authorization in actual principal-scoped RLS context; address verification-link token exposure in Python server logs before additional email tests; evaluate strict production cookie/CSRF, MFA and account recovery separately. Keep PR #4 draft and unmerged.

## Phase D follow-up — tenant isolation test harness prepared (2026-11-12)

**Status: PENDING LIVE EXECUTION** — no claim that the new isolation checks have passed.

- `mock/boxvault-m1-registration-harness.html` now retains a successful login access token in volatile page memory (never displayed or persisted) and can exercise unauthenticated/own-tenant/unrelated-tenant `GET /api/v1/containers?tenantId=...` checks.
- Expected statuses: **401** unauthenticated, **200** own tenant, **403** unrelated tenant; no cross-tenant container payload is rendered.
- `mock/tenant-isolation-readonly-lookup.md` provides an operator-only, parameterized, **read-only** tenant UUID lookup guarded to Neon `m1-security-test`. The application receives only the UUIDs typed by the tester; privileged owner DB credentials are never sent to it.
- A browser refresh clears the access token and requires a fresh reCAPTCHA-backed login. The tester also includes a **Forget access token** control.
- No API authorization rules, database privileges, migrations, user records or default Neon `dev` branch were modified.

**Next evidence needed:** operator-provided three HTTP statuses and pass/fail text from the tester; follow with independently verified RLS and cross-tenant negative cases before security release approval.

## CAPTCHA timestamp diagnostic refinement — 2026-11-12 (Asia/Manila)

**Operator evidence:** macOS UTC `2026-11-12T04:39:50Z` and Google HTTPS Date `Thu, 12 Nov 2026 04:39:50 GMT` matched exactly, reducing likelihood of a system-wide MacBook clock offset at that instant. Earlier login CAPTCHA warning was `challenge_timestamp_invalid_or_stale` despite a prior successful login.

**Source change:** commit [`f316d3a`](https://github.com/ArgeeGabrielII/BoxVault/commit/f316d3ab0bc8c5fb7e47b9057d8de5e4398a65a4) adds development-only `timestampPresent` (boolean) and `challengeAgeSeconds` (rounded relative offset or null) to the existing redacted CAPTCHA failure warning. No CAPTCHA token, provider response, private secret or absolute challenge timestamp is logged. The effective validation window stays at 120 seconds and generic unauthorized responses remain unchanged.

**Next evidence needed:** local API reload, single login attempt, and the sanitized `timestampPresent`/`challengeAgeSeconds` values if validation fails. Diagnose missing/invalid timestamp or excessively old/future challenge, without bypassing CAPTCHA.
