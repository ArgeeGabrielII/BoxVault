# Platform — M1 CI, operational controls and release gates

**Snapshot:** 2026-11-12 (Asia/Manila)  
**System:** GitHub Actions, Neon test branch, repository governance  
**Status:** CI PASSED for recorded commit; release remains **BLOCKED**.

## Repository and CI evidence

- PR [#4](https://github.com/ArgeeGabrielII/BoxVault/pull/4) is draft and unmerged at the observed snapshot, branch `feat/m1-auth-tenant-acl-rls`.
- Source snapshot [`deed36b82107de945cd359ff1796d27c0d4da0d0`](https://github.com/ArgeeGabrielII/BoxVault/commit/deed36b82107de945cd359ff1796d27c0d4da0d0) includes the local loopback mailer fix.
- CI [run 43127951167](https://github.com/ArgeeGabrielII/BoxVault/actions/runs/43127951167): **completed/success**.
- M1 Postgres Authorization Gate [run 43127951133](https://github.com/ArgeeGabrielII/BoxVault/actions/runs/43127951133): **completed/success**.
- M1 PostgreSQL Authorization Gate [run 43127951129](https://github.com/ArgeeGabrielII/BoxVault/actions/runs/43127951129): **completed/success**.
- GitHub Actions tests use disposable PostgreSQL, **not** the persistent Neon database. This evidence does not assert the real Brevo provider has been tested.

## Deployment / operational sequence

| Phase | System | Status |
|---|---|---|
| A | Prisma history adoption (`000` / `001`) on isolated Neon test | VERIFIED |
| B | Schema migrations `002`–`005` on isolated Neon test | VERIFIED |
| C | Strict auth-role GRANTs on isolated Neon test | VERIFIED |
| D | Local NestJS API + genuine CAPTCHA + real Brevo registration | PENDING |
| E | Independent security review, operational readiness, merge/release approval | NOT AUTHORIZED |

## Safeguards

- Neon default `dev` branch must remain unchanged. Reuse existing free-tier project/branch; no additional paid resources needed.
- `neondb_owner` is migration/grant role only; `boxvault_runtime_m1` handles inventory; `boxvault_auth_runtime_m1` handles identity.
- Legacy `boxvault_auth_m1` retains excessive elevated privileges; dependency audit and restricted retirement plan are outstanding; no changes executed to that role.
- Do not use `prisma migrate reset`, `db push` or blanket function grants as repair shortcuts.
- No application deployment or draft PR merge is authorized by database-change approvals.
- Green automated gates alone are not a security sign-off, production approval or evidence of provider delivery.

## Outstanding release gates

Real-provider test, full security acceptance matrix, app-focused testing, MFA/session negative cases, operational logging and retention requirements, independent review, branch protection, and documented launch authorization. See [API Phase D](../api/phase-d-real-provider-validation.md) and [security release checklist](../../security/security-release-checklist.md).
