# API — M1 authentication and tenant-onboarding implementation

**Date:** 2026-11-12 (Asia/Manila)  
**Application:** `apps/api` (NestJS + Prisma)  
**Status:** Implemented and CI-tested for scoped flows; real Brevo/reCAPTCHA end-to-end pending.  
**Branch:** `feat/m1-auth-tenant-acl-rls`, draft PR [#4](https://github.com/ArgeeGabrielII/BoxVault/pull/4).

## Technical implementation

- `apps/api/src/auth/auth.controller.ts`: registration requires reCAPTCHA v3 action `register`; verification accepts token + recipient-chosen password; login requires a genuine CAPTCHA token outside isolated CI mode.
- `apps/api/src/auth/auth.service.ts`: verified email proof is converted to a keyed token hash; the transaction invokes the hardened DB function with **no caller-provided user UUID** and sets an Argon2id password hash in the **same SERIALIZABLE transaction**.
- `apps/api/src/auth/auth-hardening.service.ts`: distributed auth rate limits; reCAPTCHA host/action/score/freshness and replay validation; Brevo SMTP; allowlist-based audit events without plaintext credentials.
- `apps/api/prisma/migrations/202611110005_token_bound_onboarding/migration.sql`: single-use unexpired `VERIFY_EMAIL` token determines account ownership; user row locked; double-provisioning denied.
- `apps/api/test/onboarding.negative.test.mjs`: isolated test checks invalid/expired/used/wrong-purpose tokens, ownership, replay, already-verified and concurrent links; loopback-only fixture guard.
- Scoped environment-specific mailer adjustment in commit [`deed36b8`](https://github.com/ArgeeGabrielII/BoxVault/commit/deed36b82107de945cd359ff1796d27c0d4da0d0): localhost HTTP links allowed in `NODE_ENV=development` or `test`, while non-loopback origins require HTTPS.

## Evidence register

| Gate | Environment | Observed result | Source |
|---|---|---|---|
| Prisma Client generation, v6.19.3 | Local macOS | PASS | Operator-supplied CLI output |
| `tsc --noEmit` | Local macOS | PASS | Operator-supplied CLI output |
| CI TypeScript/general pipeline | GitHub Actions | PASS at `deed36b8` | [CI](https://github.com/ArgeeGabrielII/BoxVault/actions/runs/43127951167) |
| Postgres authorization + auth HTTP contract | Disposable GitHub Actions PostgreSQL | PASS at `deed36b8` | [Authorization Gate](https://github.com/ArgeeGabrielII/BoxVault/actions/runs/43127951133) |
| Additional PostgreSQL RLS gate | Disposable GitHub Actions PostgreSQL | PASS at `deed36b8` | [PostgreSQL Gate](https://github.com/ArgeeGabrielII/BoxVault/actions/runs/43127951129) |
| Live Brevo SMTP verified-email registration | Local API + isolated Neon | NOT RUN / NO EVIDENCE | [Phase D](phase-d-real-provider-validation.md) |
| Live reCAPTCHA v3 `register` and `login` tokens | Browser + local API | NOT RUN / NO EVIDENCE | [Phase D](phase-d-real-provider-validation.md) |

A green CI run is evidence for the associated CI jobs, not a production launch decision.

## Security and gaps

- Auth runtime is separate from inventory runtime. Both are restricted Neon database roles; review live grants in [Phase C](../database/phase-c-identity-grants.md).
- The security-definer onboarding function trusts possession of a database-backed hashed verification proof; fully compromised auth DB credentials remain a residual privileged boundary.
- Do not set `NODE_ENV=test` or `AUTH_BOT_PROTECTION_MODE=off` to circumvent CAPTCHA for a live Neon integration test.
- Deployment of a live public API, independent security review, provider sandbox integration and production hardening remain separate release gates.

## References

[Onboarding design](../../security/m1-token-bound-onboarding.md) · [M1 security checklist](../../security/security-release-checklist.md) · [API Phase D](phase-d-real-provider-validation.md)
