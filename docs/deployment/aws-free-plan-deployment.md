# AWS Free-plan deployment checkpoint — 2026-11-19

## Scope and accepted choices

The owner authorizes AWS Free plan plus included credits only: never upgrade the AWS plan, buy a domain, activate advanced features or incur out-of-pocket AWS charges. Sydney remains the selected Region. The owner selected AWS-provided HTTPS addresses with a small Lambda API instead of the earlier domain-dependent EC2 proposal, private Single-AZ PostgreSQL, SES, and a fresh empty application database. Existing local/Neon records and Firebase previews remain intact. The temporary individual SES sender is passed privately as a parameter rather than committed to source.

This document records an **unfinished feature branch**, not an accepted release. `main` has not received these migration changes. Application deployment and live rotation have not completed.

## Verified actions this session

- Free-plan API reported FREE / ACTIVE, USD 199.45 remaining credits on the latest read, expiration 2027-05-18T05:39:04.083Z. Recheck immediately before further provisioning; this is an observation, not a permanent-free guarantee.
- Created IAM-only `boxvault-app-access` in Sydney and observed CREATE_COMPLETE. It creates `BoxVaultAppDeploy` and scoped deployment/workload boundaries. Follow-up IAM-only updates added Lambda quota metadata and narrowed CloudFormation access to the two application stacks; the permissions corrections were exercised successfully by the readiness probe. Confirm final stack status before the next change.
- Configured `boxvault-deploy`, sourcing browser credentials from `boxvault-bootstrap-owner`. Verified STS assumed `BoxVaultAppDeploy`. Existing AWS profile sections and MCP configuration were preserved. Toolkit access remains read-only. Owner-source CLI use was limited to the explicitly approved IAM bootstrap.
- Confirmed the owner-selected individual SES sender is verified in Sydney (`VerifiedForSendingStatus=true`). This does not establish domain authentication or production sending access; sandbox recipient restrictions remain.
- Lambda metadata reports regional concurrency **5**, unreserved **5**. The temporary reserved-concurrency=1 probe was rejected because the project must retain a minimum of five unreserved executions. The probe rolled back, and its stack was deleted after the owner explicitly requested removal. `boxvault-app-artifacts` is now absent; it is not an existing artifact bucket. The owner approved using the existing shared concurrency limit of five on 2026-11-19. API throttling is one request/second with burst two; hosted browser requests are queued. No quota increase or silent cap removal is authorized.
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
3. The owner approved shared-five execution. The draft removes unavailable positive reservations from all four functions, retains API-off reservation zero during staging, and uses low API throttles/browser request queues. Do not increase quotas or upgrade.
4. Build a fresh Linux artifact for the final source, verify its checksums, and rerun current-head CI in [draft PR 16](https://github.com/ArgeeGabrielII/BoxVault/pull/16). No live backend deployment can be claimed from source checks.
5. Keep the active architecture/service-map/rotation guides aligned with the accepted domainless design. Historical audits remain unchanged.
6. Recheck FREE/ACTIVE, credits, exact identity, quota/eligibility and a full reviewed estimate. Review a concrete change set before application provisioning. The artifact stack is absent after probe cleanup.
7. Provision only the approved services, apply/verify eight migrations and grants inside the private network, verify WAF protection at the actual API stage, pin crypto version and exact API/web origin, and build/publish public runtime CAPTCHA configuration without backend secrets. Enable the API only after these checks.
8. Exercise real signup/email/reset/MFA, container/item save, QR issuance/resolve/rotation and negative tenant access against public HTTPS. Family requires eligible workspace/test recipients; photos and full purchasing remain separate unfinished features.
9. Enable/test daily database password rotation, old-password rejection, runtime refresh, failure recovery and alarms. Observe two scheduled windows before claiming scheduled acceptance. Preserve local keys and existing data.

Use the read-only MCP connection for its permitted metadata calls. It does not expose the deployment profile; approved deployment CLI operations use `boxvault-deploy`. Never use the owner source for denied application operations. No source credentials or secret values belong in chat, source control or build artifacts.

## Shared-five approval and template checks

The owner approved the existing shared Lambda limit of five on 2026-11-19, with API throttling and queued browser requests. No quota increase, provisioned concurrency, Auto Scaling group or Multi-AZ is selected. The API remains reserved at zero while disabled; enabling it removes that reservation. Migration/rotation functions use the existing shared quota.

Temporary cfn-guard 3.3.0 checked both exact templates using six official registry rules: S3 public-access blocking, encryption, HTTPS-only policy and versioning; RDS public-access prohibition and deletion protection. All ten applicable evaluations passed; two RDS checks were inapplicable to the artifact-only template. Initial HTTPS checks required JSON boolean `false` rather than string `"false"`; the final checks passed. This limited rule set is not a complete security audit. The temporary binary, archive and downloaded rules were deleted as requested. AWS ValidateTemplate passed for both revised templates; local cfn-lint validation is separate from service/runtime acceptance.

## Application provisioning started

The artifact stack reached CREATE_COMPLETE; the code bucket is private, encrypted and versioned. Package commit `347d28046c8576839e447c1f7a8e4b117cab31d3` was SHA-256 verified and uploaded with an immutable object version. The application change set planned 51 additions with API and runtime rotation disabled; service pre-deployment validation returned no findings. The owner-authorized staged change set was executed after rechecking FREE/ACTIVE and credits.

The [low-use forecast](aws-prototype-forecast-2026-11-19.json) is USD 70.207 per planning month, including USD 15 contingency; it assumes 10,000 API calls, 100 CAPTCHA attempts and 100 emails. It is not an exact bill, indefinite lifetime estimate, technical spending cap or assurance that all credit months remain. Existing credits fund approximately 2.56 such months before a USD 20 reserve; monitor actual usage and review before extending. No paid-plan upgrade is authorized.

The IAM-only bootstrap update completed after adding the documented network metadata reads, alarm-tag reads, the specific RDS service-linked-role lookup and RDS-service-only managed-encryption grant. The deployment boundary permits network Describe operations but its identity policy still enumerates the exact reads. The toolkit role/boundary were not changed. Both selected endpoint services and PostgreSQL 18.6 / db.t4g.micro / 20 GiB gp3 are available in Sydney. Provisioning completion, private migrations and runtime acceptance remain to be verified.

### First attempt and preservation recovery

The first application create rolled back because all four function log groups required legacy `logs:TagLogGroup`, in addition to the newer tagging API in the schema. The IAM-only correction scopes legacy tag/untag/read-tags actions to the application log groups. No RDS instance or interface endpoint was created. Resource-history `DELETE_SKIPPED` entries did not prove existence: direct metadata checks found only the generated cryptographic secret and empty Playground bucket existed. The web/media buckets had not been created. The two existing resources are preserved and handled through an import-only change set before retry; the cryptographic root is not regenerated. The failed stack metadata was removed after verifying all resources were either deleted or retained.

The import completed successfully. A subsequent attempt stopped before database creation because `rds:DescribeEngineDefaultParameters` was missing; the Playground update was a cascade cancellation. The IAM correction now includes exact read-only RDS/Lambda metadata operations from the published CloudFormation resource schemas. A third small identity policy keeps each managed policy under its size limit. Boundary metadata patterns do not independently grant access; identity statements retain explicit reads and named-function scopes. The existing cryptographic root remains unchanged.
