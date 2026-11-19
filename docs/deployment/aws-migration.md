# AWS migration preparation

<!-- BEGIN current AWS platform -->
> **Platform policy (2026-11-19):** Follow the [accepted AWS primary-platform decision](../architecture/aws-platform-decision.md) and [daily rotation policy](secret-rotation.md): Sydney, one API host and Single-AZ RDS; Auto Scaling/Multi-AZ deferred. This document does not by itself prove hosted deployment, live rotation or production acceptance.
<!-- END current AWS platform -->

Updated 2026-11-19 (Asia/Manila). **Agent Toolkit and its read-only IAM access are installed; application migration is not complete.** The owner selected an empty AWS database. No local or Neon records have been imported, no application database or storage bucket has been provisioned, and existing local services remain in place. AWS API verification reports the Free plan is ACTIVE, with USD 200 credits at this checkpoint. Sender identity and application deployment remain pending.

## Agent Toolkit setup checkpoint

The owner confirmed the new AWS experience and selected Sydney (`ap-southeast-2`), superseding the earlier proposed Singapore region. Profile: `boxvault-restricted`. Guidance: **HIGH**, already selected by the owner.

Setup follows the [AWS guide](https://raw.githubusercontent.com/aws/agent-toolkit-for-aws/refs/heads/main/setup-instructions/setup.md). AWS CLI and uv are installed. Browser authentication and STS succeeded. The initial session used the managed owner role; the broad-profile installer was rejected by automatic approval review. The completed safer setup uses a separately provisioned `BoxVaultToolkitReadOnly` role and matching permissions boundary, defined in `infra/aws/iam/toolkit-access.json` and `toolkit-readonly-policy.json`. The Sydney stack `boxvault-toolkit-access` is CREATE_COMPLETE with exactly those two IAM resources.

Twenty-five default skills are installed for each of Codex and Kiro. Their AWS MCP entries expose only `boxvault-restricted` through `AWS_MCP_PROXY_PROFILES`; existing integrations were preserved. The installer omitted an existing Node REPL args setting, which was restored and compared against the private backup. MCP initialization and complete tools/list succeeded. Public skill catalog verification succeeded. Project guidance is installed in `AGENTS.md` and `.kiro/steering/aws-agent-toolkit.md`. Restart the AI tools to load their new connections.

STS now identifies the restricted role. A live Sydney RDS metadata read succeeded; a live IAM ListRoles call was explicitly denied. IAM simulation allows the intended identity/metadata reads and explicitly denies database creation, email sending, secret retrieval, S3 objects, role switching, IAM role creation and paid-plan upgrade. Access Analyzer returned no findings. These checks establish tooling access, not application or production acceptance.

The private browser-login source is retained as `boxvault-bootstrap-owner` for renewal and authorized IAM bootstrap, outside the MCP profile allowlist. Renew it with `aws login --profile boxvault-bootstrap-owner --region ap-southeast-2`; do not run aws login directly on the restricted role profile, which could replace that profile's intended configuration. The restricted role uses one-hour sessions. The toolkit uses `us-east-1` for its catalog/service; the project remains in Sydney. [Operational details](aws-agent-toolkit.md).

## Current state and proposed replacements

| BoxVault component | Current state | AWS target |
| --- | --- | --- |
| Relational data | Local PostgreSQL 18; separate historical Neon test branch | RDS for PostgreSQL, exact version/instance eligibility checked in chosen region |
| Authentication | NestJS Argon2/password, verified email, MFA, sessions and tenant RLS | Keep existing implementation on AWS compute and RDS |
| Transactional email | Local SMTP sink; historical Brevo configuration | SES, initially verified test recipients |
| Connected app/API | Loopback Vite proxy and local NestJS | Built React app and NestJS behind one HTTPS origin on AWS |
| Public mock / Playground | Firebase static hosting | Private S3 static origins and CloudFront, after connected deployment acceptance |
| Item photos | Not implemented | Private S3 plus authorized upload/download APIs and UI |
| Operational secrets | Private local config; separate hosted configuration | AWS runtime secret store with access restricted to the application role |
| Deployment and logs | GitHub Actions; local logs | GitHub OIDC to scoped AWS roles; bounded CloudWatch retention |

Moving the existing authentication code to AWS is sufficient to host identity data in AWS. Switching to Cognito is a separate identity migration with password/MFA compatibility and account-linking implications; it is not required for this infrastructure move. No database rewrite to DynamoDB is planned.

A candidate small prototype is one EC2 API/web host plus one private Single-AZ RDS instance, SES and private S3. EC2 should serve the built app and `/api/v1` through a TLS reverse proxy; database ingress is restricted to the API security group. This is a candidate, not a selected or guaranteed-free configuration. Compare it against Lambda/API Gateway with the real account credits and projected usage before choosing; do not add NAT Gateway, load balancer or RDS Proxy by default. Public IPv4, EBS, database storage/backups, logs, requests and egress still need pricing. A single host is not a high-availability production design.

## Account and cost discovery

AWS's current Free account plan uses credits and ends after six months or credit exhaustion. The old 750-hour RDS offer applies to eligible legacy accounts, not every new signup. A free plan is not permanent free production hosting. Confirm the actual account in Billing; do not upgrade it to Paid to make a blocked service work without a separate owner decision.

SES pricing changed in July 2026; do not assume the historical 3,000-message allowance applies to a new SES customer. New SES accounts are sandboxed per region and can initially send only to verified recipients or the simulator, with sending quotas. Verify a sender domain/email and review production access before opening signup to arbitrary recipients. SES SMTP credentials are regional and differ from normal AWS access keys.

CloudFront's $0 flat-rate service plan is distinct from the AWS Free account plan: its current documentation excludes Free Tier accounts. Check availability before selecting it. Budgets and alerts notify; they do not guarantee a spending cap or stop all resources.

Use the authenticated `boxvault-restricted` role profile for metadata checks. Never paste keys, database URLs, SMTP passwords or browser tokens into chat or GitHub. The toolkit profile cannot deploy the application; prepare a separate narrowly scoped deployment identity for that authorized work rather than broadening the toolkit identity.

Once CLI v2 and a profile exist:

```bash
pnpm aws:readiness --profile boxvault-restricted --region ap-southeast-2
```

Sydney is the owner-confirmed project Region. The command only reads caller identity, Free Tier plan metadata, SES account/verified-identity counts, RDS instance metadata and budget count. It does not send email, create a budget, provision resources, fetch stored secret values or read application records. Missing permissions return an unknown status, not an assumption of eligibility. It always requires review; an empty RDS list does not establish that a new instance would be free. Inspect console credits/expiry and a region-specific estimate before writing infrastructure.

## Prepared empty data foundation

**Owner decision (2026-11-19):** initial deployment remains one API host / Single-AZ RDS with no Auto Scaling. The draft now includes a daily rotation schedule for the RDS-managed master secret. [Daily secret-rotation scope and readiness gates](secret-rotation.md) distinguish that schedule from the unimplemented runtime-user and application-key rotation work. Nothing has been enabled live.

`infra/aws/data-foundation.json` is a concrete CloudFormation draft, not a deployed stack. It defines an isolated VPC, two private subnets, an API security group with no inbound rules, PostgreSQL ingress only from that group, an encrypted Single-AZ 20 GiB RDS database and a private S3 media bucket with public access blocked and TLS enforced. It creates no EC2 host, public IP, NAT gateway, load balancer, email identity or email message. It cannot yet be reached from your laptop: an authorized API host/SSM migration connection must be provisioned separately before applying schema migrations.

`PostgresVersion` intentionally has no default: first query an orderable PostgreSQL 18 minor version on the selected micro class in Sydney. If the account/region does not offer a compatible micro configuration, stop and compare options rather than silently changing the instance class or account plan. Native PostgreSQL 18 compatibility is not proof of RDS role/permission compatibility.

The master password is RDS-managed in Secrets Manager, which has its own charges/credit consumption. Do not use this master credential in NestJS. Runtime roles/secrets and all seven Prisma migrations remain an explicit later step; an RDS `CREATE_COMPLETE` status is not a migrated/usable application. No old data is restored for this owner-selected fresh start.

RDS deletion protection is on and both database and bucket have `Retain` policies. Deleting the CloudFormation stack will **not** remove retained resources or stop their ongoing credit consumption. Track them in the resource inventory and explicitly review cleanup when the prototype ends. This is not a free-tier enforcement template. Storage, backups, Secrets Manager, burst CPU usage and later networking/hosting still need account-specific cost checks.

Local JSON/reference validation and AWS-side `ValidateTemplate` succeeded for the draft. Regional orderability, deployment permissions, provisioning and actual daily rotation remain unverified. Before creation, produce a CloudFormation change set and review its exact resources and cost estimate. The draft does not change Firebase CI/CD.

## Retired providers and final cleanup

Neon and Brevo are no longer selected for any current environment. RDS PostgreSQL replaces Neon; SES replaces Brevo. Remove old-provider URLs/credentials from approved deployment inputs, CI secrets and operational runbooks when activating AWS. Do not run the archived Neon/Brevo harness as the current integration path. The local connected launcher remains independent of both services.

Before closing old resources, inventory retained records/backups, review applicable retention and verify that no active consumer depends on an old credential. Revoke obsolete credentials through their provider, then remove their stored copies; deleting an environment variable alone does not revoke a credential. Record closure outcomes separately. No provider deletion, credential revocation or data export has been performed by this documentation update.

## Migration sequence — fresh AWS database

1. **Preserve existing data.** The owner already selected a fresh empty AWS application database. Keep local and Neon records intact; no default dump, restore, data merge or active-session import. Inventory existing sources without reading customer content.
2. **Review the deployment.** Confirm Sydney, Free-plan/credit status, domain and SES sender, API TLS variant, instance sizing, recovery objectives and a current estimate. Prepare a change set and separately scoped deployment identity. The restricted toolkit role cannot provision the application; do not switch to its owner source to bypass a denial.
3. **Provision the empty foundation.** Create the private encrypted RDS/S3/network stack only after its reviewed change set is authorized. Provision the API host and secure Systems Manager migration path separately. Retain deletion protection and backup policies; there is no Auto Scaling or Multi-AZ in this release.
4. **Apply all seven migrations and grants.** Rehearse under RDS PostgreSQL 18 permissions: `rds_superuser` is not native PostgreSQL superuser. Keep migration, auth and content identities separate; runtime must not own tables or have BYPASSRLS. Review SECURITY DEFINER ownership/search paths and preserve FORCE ROW LEVEL SECURITY. Test the actual RDS behavior before declaring compatibility.
5. **Implement safe daily rotation.** Use the managed master schedule and separate runtime database secrets/rotation logic. Add Prisma refresh/reconnect, bounded caching, alarms and rollback. Test target password changes, old-credential rejection and two scheduled windows. Add version-aware JWT/pepper/TOTP handling before enabling their daily rollover. Do not alter local keys or copy old encrypted factors into an empty target.
6. **Connect SES and hosted UI.** Prefer SES API with the instance role; implementing that transport replaces the current SMTP-only adapter. If SMTP is retained temporarily, use regional credentials with their own tested lifecycle. Verify sender/authorized recipients, feedback and production sending access. Host the connected UI with enforced bot protection, same-origin API routing and strict cookies. Local inbox, test CAPTCHA mode and Family entitlement helpers must not be public features.
7. **Accept the end-to-end application.** Prove real signup → verification email → login/reset/MFA → saved box/items → QR issue/rotation → invitation/acceptance → private denied → shared allowed → revoke denied, with wrong-tenant, replay, concurrency and seat-limit negatives. Test public HTTPS in browsers/devices and regenerate local-only QR links. Add/test private photo uploads and finance independently; these are not complete merely because RDS is reachable.
8. **Cut over after acceptance.** Switch approved web/API traffic only after operational/security sign-off and a restore drill. Retain the Firebase mock and historical sources until replacement endpoints and artifacts are accepted. Record rollback and reconcile any new AWS writes; changing DNS alone cannot reverse divergent data. Cleanup is a separate explicit decision.

### Optional future data import (not selected)

If the owner later requests existing records, design a separate reviewed migration: select one source/history, privately back it up, rehearse restoration and reconcile IDs, ownership, grants and all seven migrations. Do not apply the baseline over a full-schema restore. Encrypted TOTP factors require matching key versions or explicit reenrollment; sessions/proofs need a deliberate retirement strategy. Avoid carrying provider superuser roles into RDS. None of these import steps runs as part of the fresh-database plan.

## Verified primary references

- [AWS Free account plan and credits](https://docs.aws.amazon.com/us_en/awsaccountbilling/latest/aboutv2/free-tier.html)
- [RDS pricing and legacy eligibility](https://aws.amazon.com/rds/pricing/)
- [SES pricing](https://aws.amazon.com/ses/pricing/) and [July 2026 pricing change](https://aws.amazon.com/blogs/messaging-and-targeting/introducing-amazon-simple-email-service-ses-pricing-plans/)
- [SES sandbox](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html) and [regional SMTP credentials](https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html)
- [RDS administrative permissions](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Appendix.PostgreSQL.CommonDBATasks.Roles.rds_superuser.html)
- [CloudFront flat-rate account requirements](https://docs.aws.amazon.com/PricingPlanManager/latest/UserGuide/plans.html)
- [CLI Free Tier plan discovery](https://docs.aws.amazon.com/cli/latest/reference/freetier/get-account-plan-state.html)
