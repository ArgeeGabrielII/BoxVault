# BoxVault AWS service map

<!-- BEGIN current AWS platform -->
> **Platform policy (2026-11-19):** Follow the [accepted AWS primary-platform decision](../architecture/aws-platform-decision.md) and [daily rotation policy](secret-rotation.md): Sydney, one API host and Single-AZ RDS; Auto Scaling/Multi-AZ deferred. This document does not by itself prove hosted deployment, live rotation or production acceptance.
<!-- END current AWS platform -->

Accepted target architecture; deployment pending, 2026-11-19 (Asia/Manila). This maps the existing React/NestJS/Prisma/PostgreSQL application to AWS. It does not deploy anything. Selected project Region: **ap-southeast-2 (Sydney)**; CloudFront is global and its control plane/certificates use us-east-1 where required. No Lambda@Edge, cross-region replication or Organizations is planned.

The project API currently reports Free / ACTIVE with USD 199.45 remaining credits at the latest observation. Credits fund eligible usage; this is not a permanently zero-cost architecture. Service inclusion in the new-experience Free plan does not establish that every configuration or usage level is covered.

## Provider replacements

**Neon → Amazon RDS PostgreSQL. Brevo → Amazon SES.** Neither old provider remains an active dependency or fallback. Historical test commands/records are retained solely as evidence. New hosted configuration uses RDS/SES; local development uses the isolated launcher.

## Selected first implementation

**Owner decision (2026-11-19):** AWS-provided HTTPS addresses, Lambda API and RDS Single-AZ, no Auto Scaling group or Multi-AZ for the initial release. Reserved concurrency one was rejected by AWS’s minimum-five-unreserved rule; proceeding within the shared five-execution quota awaits the owner’s choice. Do not provision hourly-cost resources until that decision and the full estimate are settled. Daily credential rotation is required; see [rotation policy and implementation gates](secret-rotation.md).

Run the existing modular NestJS API in a Node 24 x86_64 Lambda Event Function behind a Regional API Gateway REST API, PostgreSQL on private RDS, private files in S3, and transactional email through the SES API. Keep current password/MFA/session/Family authorization code. Private migration and rotation functions have separate IAM roles. The feature branch is prepared; live acceptance is unfinished.

For the website, use a private S3 REST origin plus CloudFront OAC. Route `/api/*` to the HTTPS API origin with caching disabled, the required Authorization/header/cookie forwarding and the same public origin as the frontend. Static assets may be cached; tenant APIs, sessions and private photos must not be cached as public content.

Use CloudFront’s default HTTPS hostname and API Gateway’s default Sydney HTTPS origin. No domain purchase, EC2, Caddy, ALB, Route 53 zone or public Lambda function URL is planned. WAF attaches to the actual API stage, protecting direct-origin requests as well as CloudFront traffic. Private functions access Secrets Manager and SES through two single-AZ interface endpoints; price their hourly costs even when no requests occur.

```mermaid
flowchart LR
    Browser[Web browser / QR link] --> Edge[CloudFront HTTPS]
    Edge --> Web[S3: React and public pages]
    Edge --> Origin[HTTPS API origin: Caddy or ALB + ACM]
    Origin --> API[EC2: existing NestJS API]
    API --> DB[(Private RDS PostgreSQL)]
    API --> Media[S3: private photos / payment evidence]
    API --> Mail[SES: account and family emails]
    Mail --> Feedback[SNS: bounce / complaint notifications]
    Feedback --> API
    API --> Secrets[Secrets Manager: exact runtime secrets]
    API --> Logs[CloudWatch: redacted logs / alarms]
```

Public origin access must be restricted so API callers cannot bypass edge protections: restrict ingress and verify a private origin header where appropriate. No private photo objects are exposed through the public static origin. Authenticated photo reads should pass through the API when immediate membership revocation is required. A presigned download remains valid until expiration and therefore does not provide immediate revocation on its own.

## Required capabilities and selected services

| Capability | Service / implementation | Scope and first-release decision |
| --- | --- | --- |
| Landing page, customer/admin/support web UI | S3 + CloudFront | Separate static website storage from private user uploads; use a private S3 REST origin with OAC, SPA routing and security headers. Business actions remain API-authorized. |
| Developer Playground | Separate S3 origin / CloudFront distribution | Keep its mock-only build, URL and deployment isolated; never give it production credentials or private API access. Keep current Firebase link until replacement passes checks. |
| API and business rules | Lambda Event Function + Regional API Gateway REST API | Existing NestJS API, native dependencies built on Amazon Linux in CI, initially disabled for migration/configuration. No provisioned concurrency. Shared-five alternative pending; preserve throttling and no automatic mutation retries. |
| PostgreSQL and persistent business records | RDS for PostgreSQL | Users, tenants, memberships, containers/items, grants, label hashes, sessions, plans, wallets, top-ups and audit records. Preserve distinct SQL migration/auth/content identities and RLS. Start with an empty database as requested. |
| Private photos and documents | S3 | Original item/container photos, thumbnails and private payment evidence. Block public access, validate upload size/type, enforce tenant/object authorization, track metadata/quotas in RDS. APIs and upload UI still need implementation. |
| Verification, reset, invitations and receipts | SES | Verified sender, regional credentials or runtime IAM, delivery limits, suppression handling and production approval for arbitrary recipients. No local inbox in public hosting. |
| Bounce / complaint feedback | SNS + signed API webhook | Deliver SES feedback to the app; validate the topic/signature, redact logs and update suppression state. No Lambda is required if the API receives the webhook. |
| Network separation | VPC, subnets, security groups, route tables | RDS is private; PostgreSQL ingress only from the API group. Functions use one isolated subnet; two subnets satisfy the RDS subnet-group requirement while the instance remains Single-AZ. Two single-AZ interface endpoints provide Secrets Manager and SES API access. No NAT, public IP or internet gateway. |
| HTTPS | CloudFront + API Gateway AWS hostnames | HTTPS at viewer and API origin, private S3 OAC, uncached API responses. No domain purchase. Sender verification is independent of visitor HTTPS. |
| Runtime credentials and encryption | Secrets Manager + service encryption / KMS | Daily database credential rotation, with runtime refresh and failure alarms. Prefer SES API/temporary IAM credentials over static SMTP passwords. JWT, pepper and TOTP keys require version-aware rotation code. See the dedicated rotation policy; no blind daily overwrites. |
| Workload / deployment permissions | IAM roles + STS | Separate read-only agent, API runtime, deployment and migration duties. The current toolkit role stays read-only. Never create an IAM identity for each BoxVault customer or map app admins to AWS admin access. |
| Logs, availability checks, alerts | CloudWatch Logs, metrics and alarms | Redact credentials/proofs, set retention and size limits, monitor API health, errors, Lambda errors/throttles/duration, database connections and email failures. Billing estimates must include log ingestion. |
| AWS administrative audit | CloudTrail | Use management-event history initially; configure a trail/retention if needed. Data-event logging has separate scope/cost. CloudTrail does not replace BoxVault's application audit/financial ledger in PostgreSQL. |
| Backups and recovery | RDS automated backups/snapshots + S3 versioning/lifecycle | Test restoration, define retention and keep backups in Sydney. Object versioning protects against some mistakes but is not an immutable independent backup. AWS Backup is optional if native coverage is insufficient. |
| Deployments and changes | CloudFormation + existing GitHub Actions + IAM OIDC | Versioned infrastructure, tests, build, controlled release and rollback. Use short-lived deployment credentials and separate code/artifact storage. CodePipeline/CodeBuild are not required while existing CI meets the need. |
| Runtime maintenance | Versioned Lambda artifacts | CI builds native dependencies; deployment uses immutable S3 object versions. No server shell or SSH access is needed. |
| Spend visibility | AWS Settings + Budgets | Monitor remaining credits/expiry, set alerts and review service estimates. Budgets do not universally stop spending. Do not upgrade the project or enable advanced features automatically. |

The capability map is the accepted service selection, not evidence that those services are configured or that the application features are complete. AWS lists the principal services above in the new-experience Free-plan catalog, subject to feature restrictions and regional availability. Check the exact instance, engine, quotas, configuration and cost before creating a change set.

## Before public signup

Keep authentication/authorization and rate limiting in the API. The feature branch includes WAF challenge/CAPTCHA browser integration and a trusted Lambda ingress boundary. Verify the Web ACL is associated with the actual API stage before enabling the function. Read challenge and CAPTCHA integration URLs from their respective AWS API responses, publish only domain-bound client configuration, and prove direct-origin requests cannot bypass protection. Human CAPTCHA and final HTTPS flows remain live acceptance steps.

The temporary individual SES sender is verified in Sydney. SES sandbox permits only verified recipients/simulator and has low quotas. Public signup requires the actual sender to be verified and production sending access to be granted. Real mail delivery, reset, MFA, invitation acceptance/revocation and phone QR scanning must pass on the final HTTPS origin before launch acceptance.

## Optional services, with triggers

| Service | Add when | Why it is not an initial dependency |
| --- | --- | --- |
| SQS + dead-letter queue | Reliable asynchronous thumbnails, email or reconciliation jobs need retries independent of API requests | A worker can initially run with the API; queue integration and transactional delivery semantics still need code. Do not log token-bearing job payloads. |
| Additional Lambda workers | Image processing, feedback or webhooks need independent execution | The API, migration and rotation functions are already selected. Additional workers require a measured need and credit estimate. |
| EventBridge Scheduler | Expiration cleanup, reminder and reconciliation jobs need managed scheduling | Request-time entitlement enforcement is still necessary; a scheduled job must never be the only check that stops expired access. |
| ECR + ECS/Fargate | Container deployments and scaling justify a container runtime | Adds image pipeline, networking and runtime choices beyond a single existing API host. |
| Auto Scaling / RDS Multi-AZ | Deferred by the owner for this small project | Excluded from the initial deployment. The selected prototype uses AWS-provided HTTPS endpoints. |
| ElastiCache / Redis | Measured caching, coordination or throughput needs justify it | Do not cache authorization without revocation design; PostgreSQL remains authoritative. |
| Cognito | A separate migration to AWS-managed identity is explicitly desired | Existing password hashes, TOTP factors, sessions and tenant identities need a migration plan. It does not replace Family/container authorization. |
| Lambda Web Functions | A later deliberate runtime migration is justified | The current draft uses standard Event Functions and a Regional REST API; do not mix Web Function deployment assumptions into it. |
| AWS Backup / enhanced security products | Recovery or compliance requirements exceed native controls | Some security services are excluded from the current new AWS experience; do not activate advanced features or upgrade the Free plan as a workaround. |

Do not provision DynamoDB, EKS, OpenSearch, Aurora, RDS Proxy, NAT Gateway, cross-region replicas or a customer-managed key by default just to make the architecture look complete. Reassess only when a requirement and cost estimate justify the component.

## Application functionality is not a separate AWS service

- **Signup/login/MFA:** current NestJS auth plus RDS and SES.
- **Family roles and access revocation:** current API and RDS membership/object policies.
- **QR generation:** existing QR library; store hashed locators in RDS and use the final HTTPS URL. No AWS QR-generation service is needed.
- **Photo uploads:** private S3 plus newly implemented API/UI authorization and quota handling.
- **Credits and subscriptions:** application ledger and plan rules in RDS. Manual top-up/payment verification or an external payment provider remains necessary; AWS billing/credits are not customer BoxVault credits. Payment evidence stays private in S3.
- **Free-user advertisements:** an ad provider/commercial arrangement is separate from hosting the app on AWS.
- **Admin/support access:** application-side roles and audit boundaries, not AWS IAM admin permissions. Operators should not receive implicit inventory or photo browsing access.
- **Product analytics:** start with explicitly defined, consent-aware application events/aggregates; CloudWatch operational metrics are not a complete product analytics system.

## Rollout order

1. Resolve the shared-five concurrency decision and full Sydney credit estimate. AWS HTTPS addresses and temporary verified sender are selected. No plan change is authorized.
2. Prepare separately scoped deployment and runtime roles; keep the existing toolkit role read-only.
3. Create private RDS, apply/review the eight migrations and runtime grants, prove positive/negative tenant and membership tests.
4. Deploy the real API and connected frontend, replace local-only controls and connect actual production bot protection.
5. Connect SES and feedback, implement private uploads and their UI, and verify real account → container/items → photo → QR → Family share/revoke workflows.
6. Connect the credit/top-up/plan flows and operator review with idempotency and an auditable financial ledger.
7. Verify logs, alarms, backups/restore, denial tests, device/browser behavior and rollback before cutover. Preserve local/Neon data and current hosting until acceptance.

## Cost boundaries and unresolved choices

The principal baseline costs are RDS instance/storage/backups, two interface endpoints, WAF and Secrets Manager; S3, SES, CDN, secrets and logs add usage-dependent costs. Credits may cover eligible usage for a limited period. Do not quote a monthly total without traffic, storage, retention, deployment sizes and a region-specific estimate.

CloudFront itself is in the new-experience Free-plan service list; its separate flat-rate service plans (including the plan marketed at USD 0/month) are not available to Free Tier projects under their current plan requirements. Do not select that pricing program as a presumed no-charge bundle.

Open decisions/acceptance: shared-five concurrency, full workload estimate, traffic/user count, photo quota and retention, downtime/recovery targets, notification ownership and SES production access. The draft selects PostgreSQL 18.6 on db.t4g.micro with 20 GiB gp3, subject to final eligibility and cost checks. IAM-only access exists; application provisioning remains unfinished. See the [deployment checkpoint](aws-free-plan-deployment.md) for current evidence.

## Primary references checked

- [New AWS experience service availability](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html)
- [S3 private origins with CloudFront OAC](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
- [SES sandbox and production access](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)
- [CloudFront flat-rate project requirements](https://docs.aws.amazon.com/PricingPlanManager/latest/UserGuide/plans.html)
- [VPC, public IPv4 and NAT pricing](https://aws.amazon.com/vpc/pricing/)
- [ACM use with EC2](https://repost.aws/knowledge-center/configure-acm-certificates-ec2) and [new-experience ACM restrictions](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html)
- [WAF supported protected resources](https://docs.aws.amazon.com/waf/latest/developerguide/web-acl-associating-aws-resource.html)
- [CloudTrail management-event history](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/view-cloudtrail-events.html)

AWS MCP skills consulted: `rds-oss`, `aws-storage`, `aws-compute`, `aws-lambda-web-functions`. Their production recommendations do not authorize paid provisioning or override the owner's Free-plan constraint.
