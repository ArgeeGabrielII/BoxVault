# AWS Free-plan deployment checkpoint — 2026-11-19

## Scope and accepted choices

The owner authorizes AWS Free plan plus included credits only: never upgrade the AWS plan, buy a domain, activate advanced features or incur out-of-pocket AWS charges. Sydney remains the selected Region. The owner selected AWS-provided HTTPS addresses with a small Lambda API instead of the earlier domain-dependent EC2 proposal, private Single-AZ PostgreSQL, SES, and a fresh empty application database. Existing local/Neon records and Firebase previews remain intact. The temporary individual SES sender is passed privately as a parameter rather than committed to source.

This document records an **unfinished feature branch**, not an accepted release. `main` has not received these migration changes. Application deployment and live rotation have not completed.

## Verified actions this session

- Free-plan API reported FREE / ACTIVE, USD 199.45 remaining credits on the latest read, expiration 2027-05-18T05:39:04.083Z. Recheck immediately before further provisioning; this is an observation, not a permanent-free guarantee.
- Created IAM-only `boxvault-app-access` in Sydney and observed CREATE_COMPLETE. It creates `BoxVaultAppDeploy` and scoped deployment/workload boundaries. Follow-up IAM-only updates added Lambda quota metadata and narrowed CloudFormation access to the two application stacks; the permissions corrections were exercised successfully by the readiness probe. Confirm final stack status before the next change.
- Configured `boxvault-deploy`, sourcing browser credentials from `boxvault-bootstrap-owner`. Verified STS assumed `BoxVaultAppDeploy`. Existing AWS profile sections and MCP configuration were preserved. Toolkit access remains read-only. Owner-source CLI use was limited to the explicitly approved IAM bootstrap.
- Confirmed the owner-selected individual SES sender is verified in Sydney (`VerifiedForSendingStatus=true`). This does not establish domain authentication or production sending access; sandbox recipient restrictions remain.
- Lambda metadata reports regional concurrency **5**, unreserved **5**. The temporary reserved-concurrency=1 probe was rejected because the project must retain a minimum of five unreserved executions. The probe rolled back, and its stack was deleted after the owner explicitly requested removal. `boxvault-app-artifacts` is now absent; it is not an existing artifact bucket. The owner’s choice about proceeding within shared concurrency five is pending. No quota increase or silent cap removal is authorized.
- No application RDS instance, private-network endpoint or hosted application deployment was provisioned in this session.

## Source prepared locally

- Free-plan guard refuses paid/closed/expired/unknown/underfunded plans, unexpected project/Region/root identity, missing estimate or insufficient reserve. It is a deployment precondition, not a live spending cap.
- Lambda adapter, SES API transport, strict RDS TLS, current database-secret loading before every invocation and pool/application replacement on database-version changes. Cryptographic root version is pinned; blind replacement fails closed on warm and cold starts. Safe daily cryptographic rollover remains separate work.
- Eighth migration establishes no-login, non-superuser, NOBYPASSRLS helper ownership and explicit helper policies while preserving FORCE RLS and restricted runtime roles. Historical migration/audit evidence is not rewritten.
- Migration and database-rotation functions, staged infrastructure draft, disabled-by-default API, private buckets, WAF CAPTCHA integration and isolated hosted frontend build.
- Amazon Linux / Node 24 package workflow without AWS credentials. The Linux package built and import-smoke-tested successfully in CI at `0662139d5f48a3539090ab30b03481fed959eb3c` ([run](https://github.com/ArgeeGabrielII/BoxVault/actions/runs/44478468705)). Its downloaded SHA-256/source-commit markers, RHEL native engines, CA and migration/grant files were verified. ZIP size: 86,996,160 bytes; uncompressed: 228,360,789 bytes. Upload through versioned S3 is required. Subsequent source changes require a fresh artifact. No deployment workflow is enabled.
- Daily managed-master rotation and staged runtime-user rotation drafts. Nothing is accepted as enabled live. Failure alarms currently have no notification delivery; alert ownership/delivery and rotation failure/overdue checks remain release work.

## Evidence and limitations

The local rehearsal applied all eight migrations using a NOSUPERUSER/NOBYPASSRLS migration owner on a disposable PostgreSQL 18 instance. Authorization/onboarding/helper-owner tests passed (15); Family HTTP lifecycle/race/revocation tests passed (18). Separate Free-plan tests (16), AWS runtime/SES/ingress/rotation-outcome tests (18), session tests (4) and SMTP/dependency regressions (3) passed. The SMTP tests needed loopback-socket permission; no existing local database was used. The final migration function’s outer grants wrapper was also rehearsed successfully on the disposable database. Rotation-outcome tests distinguish rejected previous credentials from connectivity errors; these are synthetic tests, not live rotation evidence.

API compilation, hosted frontend build/isolation checks and production dependency audit passed. CloudFormation syntax validation succeeded for the application draft; local cfn-lint caught and corrected an unsupported WAF output. Revalidate the latest exact templates and final code after further edits. Passing CI or local tests will not establish AWS production acceptance.

The accompanying [fixed-cost calculation](aws-fixed-costs-2026-11-19.json) records the public source URLs and SKUs. Official Sydney price files showed USD 18.25/month for 730 micro-instance hours, USD 2.76/month for 20 GiB gp3 and USD 18.98/month for two single-AZ interface endpoints: USD 39.99 fixed subtotal. This excludes API/Lambda, WAF/CAPTCHA, SES, secret storage/requests, S3/CloudFront, logs/alarms, CPU surplus, transfer and additional backups. A full workload estimate and operating/credit-retention plan remain required. A Free plan closes when credits or its term expire; do not upgrade automatically.

## Resume in this order

1. The earlier Codex automatic-approval-review usage limit has cleared. Approved operations resumed; this was not exhaustion of AWS credits or a determination that deployment was unsafe.
2. SES verification and temporary-probe cleanup are confirmed. Preserve the deployment/toolkit roles and sender.
3. Await the owner’s choice about using AWS’s shared five-execution limit before provisioning hourly-cost resources. If accepted, remove unavailable positive reservations from all four functions, retain API-off reservation zero during staging, and use low API throttles/browser request queues. Do not increase quotas or upgrade.
4. Build a fresh Linux artifact for the final source, verify its checksums, and rerun current-head CI in [draft PR 16](https://github.com/ArgeeGabrielII/BoxVault/pull/16). No live backend deployment can be claimed from source checks.
5. Keep the active architecture/service-map/rotation guides aligned with the accepted domainless design. Historical audits remain unchanged.
6. Recheck FREE/ACTIVE, credits, exact identity, quota/eligibility and a full reviewed estimate. Review a concrete change set before application provisioning. The artifact stack is absent after probe cleanup.
7. Provision only the approved services, apply/verify eight migrations and grants inside the private network, verify WAF protection at the actual API stage, pin crypto version and exact API/web origin, and build/publish public runtime CAPTCHA configuration without backend secrets. Enable the API only after these checks.
8. Exercise real signup/email/reset/MFA, container/item save, QR issuance/resolve/rotation and negative tenant access against public HTTPS. Family requires eligible workspace/test recipients; photos and full purchasing remain separate unfinished features.
9. Enable/test daily database password rotation, old-password rejection, runtime refresh, failure recovery and alarms. Observe two scheduled windows before claiming scheduled acceptance. Preserve local keys and existing data.

Use the read-only MCP connection for its permitted metadata calls. It does not expose the deployment profile; approved deployment CLI operations use `boxvault-deploy`. Never use the owner source for denied application operations. No source credentials or secret values belong in chat, source control or build artifacts.
