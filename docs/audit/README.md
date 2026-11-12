# BoxVault engineering audit register

**Audit snapshot:** 2026-11-12 (Asia/Manila)  
**Repository:** `ArgeeGabrielII/BoxVault`  
**Working branch:** `feat/m1-auth-tenant-acl-rls`  
**Pull request:** [#4](https://github.com/ArgeeGabrielII/BoxVault/pull/4), **draft and unmerged** at snapshot.  
**Scope:** engineering/change-control evidence; not a substitute for live application-generated security audit events.

## Structure by application and phase

| Application / component | Phase | Audit record | Observed status |
|---|---|---|---|
| API (NestJS) | M1 implementation and security hardening | [API / M1 implementation](api/m1-implementation.md) | Implemented; CI passed for scoped tests |
| API (NestJS) | D — real Brevo / reCAPTCHA onboarding validation | [API / Phase D](api/phase-d-real-provider-validation.md) | Pending local integration |
| Database (Neon / Prisma) | A — baseline history adoption | [Database / Phase A](database/phase-a-history-adoption.md) | Complete on test branch |
| Database (Neon / Prisma) | B — authentication schema deployment | [Database / Phase B](database/phase-b-schema-deployment.md) | Complete on test branch |
| Database (Neon / Prisma) | C — least-privilege authentication grants | [Database / Phase C](database/phase-c-identity-grants.md) | Complete on test branch |
| Web (React / Vite) | M1 registration interface | [Web / M1](web/m1-registration-ui.md) | Not implemented in web starter |
| Mobile (iOS / SwiftUI) | M1 authentication integration | [Mobile / M1](mobile/m1-integration.md) | Not verified |
| Shared assets | M1 asset reuse | [Assets / M1](assets/m1-shared-assets.md) | Design/scaffold only |
| Platform / CI | M1 automated security acceptance | [Platform / M1 CI](platform/m1-ci-and-release-gates.md) | CI passed at recorded SHA; release still blocked |

## Audit policy

1. **One audit per application/component and phase.** Use `docs/audit/<area>/<phase-or-milestone>.md`. Append dated, immutable-history-style entries rather than silently changing the meaning of earlier observations.
2. Capture **date/timezone**, scope, change ticket/PR/commit, actor type (operator/CI/service; no private identifiers), operation, commands or query *names* where useful, expected result, observed evidence, and sign-off.
3. Distinguish **observed**, **reported by operator**, **CI-proven**, **not run**, **pending**, and **release-blocking**. A green GitHub workflow does **not** imply passing live Neon or real Brevo tests.
4. Preserve historical notes even when superseded. Older documents under `docs/` may describe past pre-deployment states; this register supplies dated later evidence without rewriting history.
5. **Never commit** `.env`, full connection URIs, database credentials, tokens, SMTP/API secrets, JWT/refresh credentials, personal email addresses, actual customer content, raw logs containing identifiers, or CAPTCHAs. Use redacted summaries, synthetic counts, commit links and command results.
6. Record changes to persistent Neon test database separately from disposable GitHub Actions PostgreSQL. **The Neon default `dev` branch is out of scope**; no paid resources were created as part of M1.
7. An application *security audit event* (`AuthAuditEvent`) and an *engineering activity log* in this folder are different things. This folder is a human-reviewed engineering record; it is not immutable production evidence or a replacement for centralized security telemetry.
8. For any future phase, start from the [audit template](TEMPLATE.md); update this index when adding the phase.

## Milestone M1 evidence index

- Test Neon project ID: `shiny-field-66278071`; test branch ID: `br-fragrant-salad-b3ntdaa0` (`m1-security-test`).
- Six versioned migrations `202611110000` through `202611110005`. Migration `000`/`001` were recorded via Prisma `resolve --applied` after operator commands; `002`–`005` were deployed via `prisma migrate deploy`.
- Existing data preservation checkpoint, before and after schema deployment and grants: users **6**, tenants **2**, memberships **5**, containers **5**, access grants **2**, items **4**, media **4**.
- Current source-only development mailer change: commit [`deed36b8`](https://github.com/ArgeeGabrielII/BoxVault/commit/deed36b82107de945cd359ff1796d27c0d4da0d0). CI, M1 Postgres Authorization Gate and M1 PostgreSQL Authorization Gate all **passed** at this commit.
- Live verification-email delivery and end-to-end signup **not demonstrated** at this snapshot. Draft PR must stay unmerged absent explicit approval.

## Related documentation

- [M1 onboarding design](../security/m1-token-bound-onboarding.md) — authored before later live Neon deployment; temporal statements may be superseded by Phase B/C records here.
- [M1 reconciliation investigation](../development/m1-neon-reconciliation-audit-2026-11-12.md) — historical pre-deployment assessment.
- [M1 security acceptance gates](../security/m1-security-gate-status.md) — historical security-gate document; revalidate release gates against current source and evidence.
