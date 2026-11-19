# AWS Free-plan deployment checkpoint — 2026-11-19

## Scope and accepted choices

The owner authorizes AWS Free plan plus included credits only: never upgrade the AWS plan, buy a domain, activate advanced features or incur out-of-pocket AWS charges. Sydney remains the selected Region. The owner selected AWS-provided HTTPS addresses with a small Lambda API instead of the earlier domain-dependent EC2 proposal, private Single-AZ PostgreSQL, SES, and a fresh empty application database. Existing local/Neon records and Firebase previews remain intact. The temporary individual SES sender is passed privately as a parameter rather than committed to source.

This document records an **unfinished feature branch**, not an accepted release. `main` has not received these migration changes. Application deployment and live rotation have not completed.

## Verified actions this session

- Free-plan API reported FREE / ACTIVE, USD 200 credits, expiration 2027-05-18T05:39:04.083Z. Recheck immediately before further provisioning; this is an observation, not a permanent-free guarantee.
- Created IAM-only `boxvault-app-access` in Sydney and observed CREATE_COMPLETE. It creates `BoxVaultAppDeploy` and scoped deployment/workload boundaries. Follow-up IAM-only updates added Lambda quota metadata and narrowed CloudFormation access to the two application stacks; their final completion needs checking.
- Configured `boxvault-deploy`, sourcing browser credentials from `boxvault-bootstrap-owner`. Verified STS assumed `BoxVaultAppDeploy`. Existing AWS profile sections and MCP configuration were preserved. Toolkit access remains read-only. Owner-source CLI use was limited to the explicitly approved IAM bootstrap.
- Initiated SES verification for the owner-selected temporary email. The owner reports clicking the verification link; final AWS verification status has **not** been confirmed.
- Lambda metadata reports regional concurrency **5**, unreserved **5**, no existing functions at the observation. A temporary concurrency=1 probe was submitted as `boxvault-app-artifacts`, with no endpoint or invocations. Its final status is unknown. This stack is currently the **probe**, not the artifact bucket.
- No application RDS instance, private-network endpoint or hosted application deployment was provisioned in this session.

## Source prepared locally

- Free-plan guard refuses paid/closed/expired/unknown/underfunded plans, unexpected project/Region/root identity, missing estimate or insufficient reserve. It is a deployment precondition, not a live spending cap.
- Lambda adapter, SES API transport, strict RDS TLS, current database-secret loading before every invocation and pool/application replacement on database-version changes. Cryptographic root version is pinned; blind replacement fails closed on warm and cold starts. Safe daily cryptographic rollover remains separate work.
- Eighth migration establishes no-login, non-superuser, NOBYPASSRLS helper ownership and explicit helper policies while preserving FORCE RLS and restricted runtime roles. Historical migration/audit evidence is not rewritten.
- Migration and database-rotation functions, staged infrastructure draft, disabled-by-default API, private buckets, WAF CAPTCHA integration and isolated hosted frontend build.
- Amazon Linux / Node 24 package workflow without AWS credentials. **The Linux package has not been built or smoke-tested in CI yet.** No deployment workflow is enabled.
- Daily managed-master rotation and staged runtime-user rotation drafts. Nothing is accepted as enabled live. Failure alarms currently have no notification delivery; alert ownership/delivery and rotation failure/overdue checks remain release work.

## Evidence and limitations

The local rehearsal applied all eight migrations using a NOSUPERUSER/NOBYPASSRLS migration owner on a disposable PostgreSQL 18 instance. Authorization/onboarding/helper-owner tests passed (15); Family HTTP lifecycle/race/revocation tests passed (18). Separate Free-plan tests (16), AWS runtime/SES/ingress tests (12), session tests (4) and SMTP/dependency regressions (3) passed. The SMTP tests needed loopback-socket permission; no existing local database was used. The disposable grants wrapper used by the final migration function still needs its own final rehearsal.

API compilation, hosted frontend build/isolation checks and production dependency audit passed. CloudFormation syntax validation succeeded for the application draft; local cfn-lint caught and corrected an unsupported WAF output. Revalidate the latest exact templates and final code after further edits. Passing CI or local tests will not establish AWS production acceptance.

The accompanying [fixed-cost calculation](aws-fixed-costs-2026-11-19.json) records the public source URLs and SKUs. Official Sydney price files showed USD 18.25/month for 730 micro-instance hours, USD 2.76/month for 20 GiB gp3 and USD 18.98/month for two single-AZ interface endpoints: USD 39.99 fixed subtotal. This excludes API/Lambda, WAF/CAPTCHA, SES, secret storage/requests, S3/CloudFront, logs/alarms, CPU surplus, transfer and additional backups. A full workload estimate and operating/credit-retention plan remain required. A Free plan closes when credits or its term expire; do not upgrade automatically.

## Resume in this order

1. Resolve the Codex automatic-approval-review usage block. It reported retry at **12:50 PM Asia/Manila on 2026-11-19**. This is a Codex tool-review limit, not exhaustion of AWS credits or a finding that the action was unsafe. Do not bypass review with another identity/tool.
2. Using the approved scoped deployment profile, confirm SES status and inspect `boxvault-app-artifacts` probe stack/events. Check the IAM-only update using its authorized bootstrap path if necessary.
3. If reserved concurrency=1 is rejected under the five-execution quota, reconcile the design with the owner before provisioning hourly-cost resources. Do not request a paid upgrade, increase quotas or silently remove the cap. Remove the temporary probe resources after checking, preserving any unrelated resources.
4. Finish/readiness-test the Linux artifact and migration grants wrapper; review all SDK-generated permission baselines and resource scopes. Persist the branch to a draft PR, run current-head CI and review the security migration. No live backend deployment can be claimed from these source checks.
5. Reconcile the current architecture/service-map/rotation guides with the newly accepted domainless design. Historical audits remain unchanged.
6. Recheck the FREE/ACTIVE plan, credits, exact identity, quota/eligibility and reviewed estimate. Review a concrete change set before application provisioning. The artifact stack currently contains a probe and cannot be treated as an existing artifact bucket.
7. Provision only the approved services, apply/verify eight migrations and grants inside the private network, verify WAF protection at the actual API stage, pin crypto version and exact API/web origin, and build/publish public runtime CAPTCHA configuration without backend secrets. Enable the API only after these checks.
8. Exercise real signup/email/reset/MFA, container/item save, QR issuance/resolve/rotation and negative tenant access against public HTTPS. Family requires eligible workspace/test recipients; photos and full purchasing remain separate unfinished features.
9. Enable/test daily database password rotation, old-password rejection, runtime refresh, failure recovery and alarms. Observe two scheduled windows before claiming scheduled acceptance. Preserve local keys and existing data.

Use the read-only MCP connection for its permitted metadata calls. It does not expose the deployment profile; approved deployment CLI operations use `boxvault-deploy`. Never use the owner source for denied application operations. No source credentials or secret values belong in chat, source control or build artifacts.
