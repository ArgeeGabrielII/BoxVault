# BoxVault Security Acceptance Checklist

<!-- BEGIN current AWS platform -->
> **Platform policy (2026-11-19):** Follow the [accepted AWS primary-platform decision](../architecture/aws-platform-decision.md) and [daily rotation policy](../deployment/secret-rotation.md): Sydney, one API host and Single-AZ RDS; Auto Scaling/Multi-AZ deferred. This document does not by itself prove hosted deployment, live rotation or production acceptance.
<!-- END current AWS platform -->

**Production acceptance — 2026-11-19:** These boxes are release gates, not source-completion flags. AWS is primary; local auth/Family/inventory/QR tests and a restricted toolkit do not establish hosted provider, media, finance, rotation or recovery acceptance. The old own-tenant 403 was superseded by the recorded 401/200/403 retest. [Platform decision](../architecture/aws-platform-decision.md).

This file is a **release gate** and future verification tracker. **All boxes are initially unchecked.** Do not interpret the specification as proof of implementation.

## P0 — Security foundations (block customer-data persistence)

- [ ] Designate security owner and maintain documented threat model and data classification.
- [ ] Implement verified identity, session revocation and refresh-token replay detection.
- [ ] Family seat limit (4 total including owner) enforced transactionally.
- [ ] Application authorization guard on every protected route, deny by default.
- [ ] PostgreSQL RLS on every tenant content/financial table with separate runtime/migration roles.
- [ ] Test two disjoint tenants for CRUD, search, counts, async jobs, labels and media.
- [ ] Use private media store, object-level auth and expiring upload/download links.
- [ ] QR/NFC tags resolve authenticated authorized resources only; rotation/revocation.
- [ ] No sensitive records in logs, errors, analytics, traces or screenshots.
- [ ] Admin/operator has no content read access through UI, API, DB role or media identity.

## P1 — Production payment/accounting gate

- [ ] Independently verify incoming transfer using receiving bank history.
- [ ] Harden receipt upload, scan, metadata protection and retention.
- [ ] Approve top-up atomically with ledger posting and wallet increment.
- [ ] Prevent double approval and redemption under race/retry/crash.
- [ ] All credit adjustments append reversal entries; never edit ledger entries.
- [ ] Require MFA/step-up access for payment review and finance operations.
- [ ] Financial audit, daily reconciliation and ledger integrity alarms working.
- [ ] iOS contains no purchase flows, pricing, receipt uploads, external checkout links or calls-to-action; App Store review pathway confirmed.

## P2 — Infrastructure/reliability gate

- [ ] HTTPS/TLS, strict CORS, CSP/HSTS, rate limits and upload size limits verified.
- [ ] Secret scan/dependency scan/SAST and security integration tests are CI required checks.
- [ ] Backups encrypted off-site, restore tested, RPO/RTO defined.
- [ ] EC2/OS patched; private RDS and protected HTTPS origin; SSM/runtime/deployment identities scoped; no public SSH/database access.
- [ ] Initial AWS change set has one API host and Single-AZ RDS; no Auto Scaling or Multi-AZ. Free plan and Sydney regional scope preserved.
- [ ] Daily master/auth/content database password rotation changes the actual target, refreshes runtime pools and succeeds across two observed windows with tested failure alerts/recovery.
- [ ] JWT signing overlap, pepper/recovery migration and TOTP versioned decryption/re-encryption pass before daily cryptographic key rollover is enabled.
- [ ] Agent access remains read-only; owner login excluded from MCP; no secret values appear in build/test/rotation evidence.
- [ ] Data export, deletion request, retention and incident runbook completed.
- [ ] Outside security review/penetration test completed and high findings resolved.
- [ ] Philippine privacy, tax/registration/payment-credit terms and Apple distribution review completed.

## Mandatory attack/negative test matrix

| Scenario | Expected outcome | Verification |
|---|---|---|
| Tenant A requests Tenant B container by UUID | 403/404, no metadata | API integration |
| Tenant A lists/searches B's items | zero results, no total count leakage | API integration |
| Member removed while having active refresh token | token rejected and downloads inaccessible | Session/RLS |
| Unauthenticated attacker scans valid QR/NFC | sign-in required; no owner/title/image leaked | Mobile/API |
| Attacker guesses/replays label token | no bypass; revoked tag rejected | API |
| Admin requests inventory API or media URL | forbidden even with admin credentials | Role/IAM |
| Concurrent approval of one top-up | exactly one CREDIT journal entry | Database concurrency |
| Same bank payment submitted for two requests | alert/reject second credit | Fraud test |
| Concurrent redemptions exceed wallet balance | exactly one wins; no negative balance | Transaction test |
| Malicious oversized/decompression-bomb photo | upload rejected, no unsafe processing | Media pipeline |
| Log/tracing includes authentication or inventory payload | test fails/redaction enforced | CI/log test |
| Restore encrypted RDS/S3 recovery checkpoint | complete recovery within defined target | DR exercise |
| Rotate a database password during active requests/restart | current credentials reconnect; tenant scope and grants preserved | Rotation/HTTP |
| Rotate signing/pepper/TOTP key versions | valid unexpired flows and stored MFA remain usable; retired versions handled | Auth/key migration |
| Rotation fails or becomes overdue | scoped alert fires; target/secret consistency recovered without logging values | Operational drill |

Record test name, reviewer, evidence URL, date, environment and result for each row before go-live. Never place actual customer data or credentials in test evidence.
