# ADR-AWS-001: AWS is BoxVault's primary SaaS platform

Decision accepted by the owner on 2026-11-19 (Asia/Manila). This is the authoritative platform and secret-rotation decision. It supersedes earlier home/hybrid/GCP proposals and the use of Firebase, Neon or Brevo as the primary application platform. It does not retroactively change test evidence or claim a completed cloud cutover.

## Platform and initial topology

BoxVault is the SaaS application; AWS supplies its primary hosting and managed infrastructure. The selected new-experience AWS project is in **Sydney (`ap-southeast-2`)**.

- React public/customer/admin/support web: private S3 static origin and CloudFront, with an isolated Developer Playground build/origin.
- NestJS API: **one EC2 instance**, encrypted EBS, least-privilege instance role and Systems Manager administration. No Auto Scaling in the initial release.
- Database: **Single-AZ RDS for PostgreSQL**, private subnets and API-only security-group ingress. No Multi-AZ or replicas in the initial release. Preserve the separate migration, authentication and content SQL identities and tenant/object RLS.
- Private photos, thumbnails and payment evidence: private S3, with API authorization, quotas and validated uploads. Do not publish these through the website origin.
- Transactional email: SES, with verified sender and production access for arbitrary recipients; feedback via SNS/API as implemented. Prefer SES API temporary IAM credentials over long-lived SMTP credentials. The current mailer remains SMTP-only until that transport change is implemented.
- Runtime credentials: Secrets Manager; daily database credential rotation, bounded runtime refresh, scoped rotation identity and failure alarms.
- Observability: redacted CloudWatch logs/alarms; CloudTrail for AWS administrative activity; application and financial audit records remain in PostgreSQL.
- Delivery: existing GitHub Actions with short-lived IAM/OIDC deployment access and CloudFormation. Current source templates are under `infra/aws`; retained Firebase preview verification lives under `infrastructure/firebase`.
- Budget: preserve the Free plan, monitor credits/expiry and estimate actual Sydney usage. No automatic upgrade, advanced-feature activation, Organizations or Control Tower setup.

CloudFront is global; its management/certificates and the toolkit service use us-east-1 where required. Regional application resources stay in Sydney. No cross-region replicas, Lambda@Edge or StackSets.

HTTPS remains required end-to-end. A lean API origin may use Caddy with a valid domain/ACME certificate; that certificate issuer is external to AWS. Fully AWS-managed certificate handling uses ALB + ACM and its additional costs. A load balancer for TLS does not imply Auto Scaling. Domain/sender identity and the final TLS variant remain decisions before public deployment. See the [complete service map](../deployment/aws-service-map.md).

## Provider replacement decision

The owner explicitly confirmed on 2026-11-19 that **Neon and Brevo will no longer be used**. They are retired providers, with no fallback or dual-provider runtime in the selected stack.

| Retired provider | AWS replacement | Active configuration rule |
| --- | --- | --- |
| Neon hosted PostgreSQL | Amazon RDS for PostgreSQL, private Single-AZ in Sydney | New hosted environments use RDS with separate migration/auth/content roles. Local development uses the isolated loopback database. |
| Brevo transactional email | Amazon SES in Sydney | Verification, password reset and Family mail use SES. Prefer the API with temporary IAM credentials; implement the adapter before hosted release. |

Preserving old records/audits is not continued service use. Do not reuse old Neon URLs or Brevo credentials in new configuration, CI, backend deployment or secret stores. Retire the legacy Neon-specific mock lookup path from current test procedures; never repoint its privileged lookup to RDS. Review/revoke obsolete provider credentials and close resources only after data-preservation and AWS acceptance checks, using a separately authorized cleanup. This documentation change does not delete provider resources or make the unfinished AWS application available.

## Daily rotation policy

| Secret/credential | Required policy | Deployment status |
| --- | --- | --- |
| RDS managed master/migration password | Secrets Manager managed rotation every day | `DatabaseMasterDailyRotation` exists in the undeployed RDS draft; never use master credentials in NestJS |
| Auth/content SQL user passwords | Separate daily-rotated secrets, dedicated rotation implementation and application connection refresh | Lambda/database role integration and Prisma refresh still need implementation and acceptance |
| AWS workload, SES API and CI access | Automatically refreshed short-lived IAM/STS credentials | Toolkit role access exists; application and deployment roles remain separate work |
| JWT signing, session/proof/recovery pepper and TOTP encryption keys | Version-aware rollover, overlap/rehash/re-encryption and safe retirement before automatic daily changes | Current single-key implementations are not rotation-ready; blind replacement is forbidden |
| Retained third-party secrets | Provider-supported staged replacement | Must update the upstream provider and all consumers, not merely a stored random value |

Proposed database rotation window: **08:00–09:00 Asia/Manila**, represented by `rate(1 day)` with a one-hour UTC rotation window. There is no live daily rotation acceptance yet. Rotation must change the real target credential, update its current secret version, refresh application connections, and prove success/failure recovery across at least two scheduled windows. See the [rotation policy](../deployment/secret-rotation.md).

## Current state versus target

| Area | Verified current state | Remaining work |
| --- | --- | --- |
| Local connected app | Registration/verification, auth/MFA, saved boxes/items, QR generation/rotation/resolution, Family controls and scoped HTTP/session tests | Production browser/device/provider acceptance; private photos, full billing and other documented limits |
| AWS tooling | Codex/Kiro skills and MCP configured; `boxvault-restricted` assumes `BoxVaultToolkitReadOnly`; role/boundary stack and allow/deny checks verified | Keep tooling read-only; use separately scoped identities for authorized deployment/runtime/rotation |
| AWS project plan | Free/ACTIVE and USD 200 credits observed on 2026-11-19 | Monitor actual remaining credits, service limits and expiry; no recurring-price or permanent-free guarantee |
| AWS application infrastructure | RDS/S3/network draft and daily master-rotation schedule prepared; template syntax validated | Provisioning, seven migrations, runtime grants, email, secret refresh, alarms, restore tests and cutover |
| Firebase | Existing disconnected mock dashboard/Playground preview and static deployment guards retained | Replace only after AWS artifacts and final endpoints are accepted; do not wire private backend into the mock build |
| Neon/Brevo | Retired from the selected stack; existing records and historical evidence preserved | No fallback/new environment use; resource closure and old credential revocation require a reviewed preservation/cleanup step |

The owner selected a **fresh empty AWS application database**. No existing local or Neon records are imported automatically. Data preservation and any later import are distinct decisions.

## Access and secrets

- `boxvault-restricted` is for metadata/knowledge tooling only; it explicitly denies application writes, secret values, S3 object access, email sends, IAM changes, role switching and plan upgrades.
- `boxvault-bootstrap-owner` is a separate browser-login source for renewal and explicitly authorized IAM bootstrap. Do not expose it to MCP or use it as an application-operation denial workaround.
- Application, deployment, rotation and migration identities have different scopes. An application admin/support role is not an AWS administrator.
- Never request, commit or print actual secret values. References/identifiers and outcomes may be recorded; values must resolve directly into approved runtimes.
- A value changed in Secrets Manager does not update a running process environment or an existing Prisma connection pool. Implement and test refresh/reconnect before enabling runtime password rotation.
- Daily key rotation must not silently invalidate all sessions, invitations, recovery codes or stored TOTP secrets. Key versioning is required work, not an implied completed control.

## Release and documentation rules

Engineering completion, CI, provider tests and production acceptance are separate. An IAM stack, valid template, mock deployment or successful local test is not an accepted production AWS backend. Public signup bot protection, private uploads, transaction-safe credits, real-device flows, backups/restoration, alert ownership and applicable legal/privacy review remain release gates.

All active documents follow this decision. Dated audit records and former-provider runbooks retain original commands, results, dates and commit references as historical evidence; their current-platform notes point here. Product prices, Family's four-seat cap, content isolation, web-only purchasing and iOS companion restrictions remain unchanged by the hosting decision.
