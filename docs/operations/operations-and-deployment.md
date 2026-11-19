# Operations, deployment, reliability and costs

<!-- BEGIN current AWS platform -->
> **Platform policy (2026-11-19):** Follow the [accepted AWS primary-platform decision](../architecture/aws-platform-decision.md) and [daily rotation policy](../deployment/secret-rotation.md): Sydney, one API host and Single-AZ RDS; Auto Scaling/Multi-AZ deferred. This document does not by itself prove hosted deployment, live rotation or production acceptance.
<!-- END current AWS platform -->

Current baseline, 2026-11-19: **AWS is primary**, Sydney (`ap-southeast-2`). One EC2 API host, private **Single-AZ** RDS PostgreSQL, private S3 and SES. Auto Scaling and Multi-AZ are deferred. [Platform decision](../architecture/aws-platform-decision.md), [service map](../deployment/aws-service-map.md).

The read-only toolkit IAM stack is installed. Application infrastructure, live rotation, mail, uploads, backups/restoration and production cutover remain unaccepted. Firebase is a retained disconnected mock preview; local PostgreSQL and historical Neon/Brevo evidence are preserved. This document does not authorize a plan upgrade or claim a deployed SaaS backend.

## Environments and identities

- Local: persistent private PostgreSQL/synthetic SMTP through `pnpm dev:local`; no AWS migrations or real payments.
- CI: disposable PostgreSQL and mail fixtures, migrations, auth/RLS/Family/QR/session and artifact checks as implemented. No hosted production credentials.
- AWS pilot: fresh database, approved TLS origin, scoped runtime/deployment/rotation roles and synthetic acceptance data. A separate staging fleet is not provisioned by default.
- Production: only after provider/browser/device/security/recovery and business acceptance. Single-instance downtime must be an explicit service limitation, not an implied HA guarantee.

Use `boxvault-restricted` for tooling metadata only. The owner source is for renewal and explicitly authorized IAM bootstrap. Runtime gets only its own secrets/objects/email sender; migrations do not run with customer runtime credentials. App admin/support is distinct from AWS/SQL infrastructure administration.

## Deployment and rollback

1. Review a Sydney usage/cost estimate, Free-plan service constraints, remaining credits and expiration. Never activate paid/advanced features automatically.
2. Finalize domain/sender and TLS: CloudFront HTTPS plus a valid HTTPS API origin; Caddy/ACME is the lean software option, ALB+ACM the AWS-managed certificate option with extra cost. Protect origin access and disable private API caching.
3. Review a CloudFormation change set for the fresh application target. No Auto Scaling, Multi-AZ, replicas, NAT gateway or paid security add-ons by default. A two-subnet RDS subnet group does not mean a Multi-AZ database.
4. Deploy private RDS and verify current engine/instance orderability. Apply the seven migrations and reviewed distinct runtime grants; prove SQL/RLS and schema/history consistency. Do not import old data automatically or disable RLS to make a migration pass.
5. Deploy built API/web artifacts through scoped short-lived GitHub OIDC credentials. Preserve app/data compatibility during rollout; do not run Vite or `pnpm dev:local` on the hosted target.
6. Complete actual SES, bot protection, private upload and entitlement integrations; remove local-only inbox/Family helpers from the cloud UI. Keep Firebase previews until replacement artifacts/endpoints pass acceptance.
7. Run positive/negative account → box/items → photo → QR → Family share/revoke tests and the financial tests for any enabled billing feature. Verify real devices and the final HTTPS label origin.
8. Take/verify a recovery checkpoint before breaking changes. Roll back app artifacts only where schema compatibility holds; reconcile any new AWS writes before reverting a data endpoint. Switching DNS alone does not reconcile divergent databases.

## Daily secret rotation

The [rotation policy](../deployment/secret-rotation.md) is mandatory. The draft RDS master secret has `rate(1 day)`, one-hour window (08:00–09:00 Asia/Manila). Runtime auth/content SQL passwords need separate daily rotation and Prisma pool refresh. Prefer SES API/temporary IAM credentials; do not store a static AWS key just to rotate it daily.

JWT signing, HMAC pepper and TOTP encryption keys require version-aware verification, recovery-code handling and ciphertext migration before automatic daily rollover. A newly stored value is not proof the database/provider changed or that consumers refreshed it. No local crypto key is overwritten by this policy.

Acceptance: controlled rotation, fresh connection, chosen old-password invalidation behavior, preserved grants/RLS, full account/share/QR tests across rotation and restart, observed completion in at least two daily windows, failure alert and tested target/secret recovery. Rotation failure is a release/incident event. The runtime/rotation identities are separate; tooling stays read-only. Never retrieve secret values into chat, logs or evidence.

## Backups and recovery

Use encrypted RDS automated backups/snapshots and S3 versioning/lifecycle with stated retention. Keep recovery credentials separate; protect metadata and originals consistently. Perform an isolated restore exercise at least monthly during pilot and after major schema changes. RPO/RTO 24 hours are initial targets to validate, not guarantees. Same-project versioning is not an independent immutable backup; review additional protection if the risk warrants it without introducing cross-region services automatically.

The RDS/media foundation draft retains resources and enables DB deletion protection. Deleting its stack does not necessarily remove retained objects or stop credit consumption. Inventory retained resources before approving cleanup. Never delete local/Neon data or the toolkit identity as speculative cleanup.

## Monitoring and incident response

CloudWatch: API availability/5xx/latency, memory/disk, database connections, uploads/quota failures, email feedback, rotation success/age, backup age and restore evidence. Set bounded retention and alert owners. CloudTrail covers AWS management activity; application audit and append-only financial ledger remain in RDS. Do not record passwords, JWTs/proofs, content titles, media/evidence bytes, signed URLs or full request bodies.

Runbooks: app rollback; rotation failure/compromise; backup/restore; private-object exposure; member revocation; duplicate payment/refund; credit reconciliation; account export/deletion; certificate renewal; provider outage and privacy incident communications. Diagnose an unexpected AccessDenied using the actual identity/policy and AWS Settings spend status; never broaden the toolkit profile or use its owner source as an application workaround.

## Costs and availability

Track EC2/RDS baseline, EBS, public IPv4, storage/backup versions, secrets, requests, logs and egress. ALB, WAF, endpoints and queues add costs when selected. Credit coverage and service inclusion do not guarantee permanent zero cost. Use AWS Settings for project billing/spend controls and Budgets for alerts; budget alerts do not universally stop resources.

Do not present old home/GCP planning figures as AWS quotes. Price actual Sydney configuration and usage before provisioning, and review monthly against application quotas and credits. One EC2 and Single-AZ RDS can be unavailable during failures/maintenance/rotation reconnects. Do not advertise an SLA based solely on green CI or a target availability percentage.
