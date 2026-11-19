# AWS migration preparation

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

`infra/aws/data-foundation.json` is a concrete CloudFormation draft, not a deployed stack. It defines an isolated VPC, two private subnets, an API security group with no inbound rules, PostgreSQL ingress only from that group, an encrypted Single-AZ 20 GiB RDS database and a private S3 media bucket with public access blocked and TLS enforced. It creates no EC2 host, public IP, NAT gateway, load balancer, email identity or email message. It cannot yet be reached from your laptop: an authorized API host/SSM migration connection must be provisioned separately before applying schema migrations.

`PostgresVersion` intentionally has no default: first query an orderable PostgreSQL 18 minor version on the selected micro class in Sydney. If the account/region does not offer a compatible micro configuration, stop and compare options rather than silently changing the instance class or account plan. Native PostgreSQL 18 compatibility is not proof of RDS role/permission compatibility.

The master password is RDS-managed in Secrets Manager, which has its own charges/credit consumption. Do not use this master credential in NestJS. Runtime roles/secrets and all seven Prisma migrations remain an explicit later step; an RDS `CREATE_COMPLETE` status is not a migrated/usable application. No old data is restored for this owner-selected fresh start.

RDS deletion protection is on and both database and bucket have `Retain` policies. Deleting the CloudFormation stack will **not** remove retained resources or stop their ongoing credit consumption. Track them in the resource inventory and explicitly review cleanup when the prototype ends. This is not a free-tier enforcement template. Storage, backups, Secrets Manager, burst CPU usage and later networking/hosting still need account-specific cost checks.

Local JSON/reference validation is available without authentication; AWS-side `validate-template`, regional orderability, account permissions and resource creation remain unverified. Before creation, produce a CloudFormation change set and review its exact resources and cost estimate. The draft does not change Firebase CI/CD.

## Migration sequence

1. **Identify the source.** Decide whether the authoritative data is the local database, hosted Neon test branch or a fresh database. Local and hosted databases are separate histories; do not automatically merge account/tenant IDs or sample fixtures. Record source version and migration history, counts and ownership constraints without exposing content.
2. **Choose and review the stack.** Confirm account/region, remaining credits, expected use, sender/domain, TLS hostname and a monthly cost estimate. Prepare infrastructure as code with encrypted storage, restricted roles/networking and resource tags. Do not change Firebase DNS/deployments or delete old providers at this stage.
3. **Rehearse on an empty AWS target.** Use a private encrypted logical backup and a restore rehearsal. Choose one consistent restoration method: a full logical restore preserving schema, security functions, policies, data and `_prisma_migrations`, or migrations followed by a reviewed data import; do not apply the baseline on top of a full schema restore. Use `--no-owner --no-acl` when adapting a logical dump, then explicitly reconstruct reviewed roles, ownership and grants. Do not carry provider-specific roles, local superuser attributes or credentials into RDS.
4. **Verify RDS security behavior.** RDS administrator is `rds_superuser`, not a native PostgreSQL superuser. Rehearse all seven migrations and SECURITY DEFINER helper ownership under RDS permissions, keeping content/auth runtime roles distinct and without BYPASSRLS or table ownership. Do not disable FORCE ROW LEVEL SECURITY to make an import or test pass. Check grants/search paths, constraints, complete record counts and schema drift; counts alone do not prove correct access control.
5. **Preserve identity and handle secrets.** Copy user IDs, password hashes, verified state and memberships consistently. Existing encrypted TOTP factors require their matching encryption key or an explicit reenrollment procedure. Decide whether to preserve or expire pending HMAC proofs and sessions. Force reauthentication at cutover; do not migrate active local browser cookies to a new public origin. Keep backups, signing keys, pepper, TOTP key and SMTP credentials outside source control and build output. Use separate AWS runtime/migration credentials.
6. **Connect SES and cloud UI.** Configure regional SMTP host, port 587/STARTTLS, verified sender and regional SMTP credentials; test against authorized recipients. Use the real production environment and enforced bot protection. Remove local-only inbox and Family entitlement controls from the cloud UI. Preserve authenticated same-origin API requests, strict refresh cookies and private no-store responses. The current connected page is local-only and does not yet supply production CAPTCHA proofs: it cannot simply be uploaded unchanged and expected to sign users in. Review AWS-native bot protection as a separate implementation if all third-party infrastructure must be removed; do not disable CAPTCHA to claim migration success.
7. **Accept before cutover.** Prove register → real verification email → login/reset/MFA → saved box/items → label issue/rotation → invite/accept → private denied → shared allowed → revoke denied, plus wrong-tenant, replay and concurrent seat-limit negatives. Repeat browser/device tests against the public HTTPS origin. A local `127.0.0.1` QR must be regenerated for that origin. Add private photo APIs/UI and their access tests before claiming picture uploads work. Buying credits remains a separate feature.
8. **Cut over with rollback available.** Pause source writes briefly, take the final backup, import/verify, switch traffic and watch delivery/errors. Retain the old source read-only for an agreed rollback window. Define reconciliation for any writes on AWS before rollback; switching DNS alone cannot safely roll back divergent databases. Remove old services only after successful acceptance and a backup/restore exercise.

Do not run `pnpm dev:local` as the AWS deployment command. It intentionally creates its own loopback database, test SMTP sink and CAPTCHA-off test profile. AWS deployment must have its own production configuration and build path. No destructive migration, AWS plan upgrade, source deletion, domain purchase or hosted cutover has occurred. Only the dedicated toolkit IAM access stack has been created.

## Verified primary references

- [AWS Free account plan and credits](https://docs.aws.amazon.com/us_en/awsaccountbilling/latest/aboutv2/free-tier.html)
- [RDS pricing and legacy eligibility](https://aws.amazon.com/rds/pricing/)
- [SES pricing](https://aws.amazon.com/ses/pricing/) and [July 2026 pricing change](https://aws.amazon.com/blogs/messaging-and-targeting/introducing-amazon-simple-email-service-ses-pricing-plans/)
- [SES sandbox](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html) and [regional SMTP credentials](https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html)
- [RDS administrative permissions](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Appendix.PostgreSQL.CommonDBATasks.Roles.rds_superuser.html)
- [CloudFront flat-rate account requirements](https://docs.aws.amazon.com/PricingPlanManager/latest/UserGuide/plans.html)
- [CLI Free Tier plan discovery](https://docs.aws.amazon.com/cli/latest/reference/freetier/get-account-plan-state.html)
