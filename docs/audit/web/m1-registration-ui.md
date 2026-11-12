# Web — M1 registration interface audit

**Date:** 2026-11-12 (Asia/Manila)  
**Application:** `apps/web` (React / Vite)  
**Status:** NOT IMPLEMENTED for registration; starter UI exists.

## Source-grounded observation

At the feature-branch snapshot, `apps/web/src/App.tsx` displays the BoxVault logo, health connectivity state and development-starter messaging. It **does not** expose registration, verification-link handling, sign-in, Google OAuth, MFA setup or a reCAPTCHA v3 token generator. The web client points at the configurable `VITE_API_BASE_URL` (fallback local API). These are source-code observations, not a browser acceptance test.

## M1 gate matrix

| Gate | Status | Evidence needed |
|---|---|---|
| Browser UI for signup and password policy | PENDING | Implemented React form + accessibility tests |
| Genuine reCAPTCHA v3 action `register` | PENDING | Public localhost key, action-matched server verification |
| Verification email link handling | PENDING | Safe token submission; avoid token leaks in telemetry/history |
| Login with reCAPTCHA v3 action `login` | PENDING | Client + API integration |
| Session and MFA UX | PENDING | Negative authorization, logout, cookie safety tests |
| Privacy, legal and account errors | PENDING | UX/security acceptance suite |

## Next implementation

Use a **local-only** browser harness for Phase D API verification or build the real web form after source review. Do not commit provider secrets or verification tokens. Keep `NODE_ENV=development` and CAPTCHA enforced when using live Neon.

**Related audit:** [API Phase D](../api/phase-d-real-provider-validation.md). No web deployment or PR merge authorized.
