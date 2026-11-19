# Infrastructure

<!-- BEGIN current AWS platform -->
> **Platform policy (2026-11-19):** Follow the [accepted AWS primary-platform decision](../docs/architecture/aws-platform-decision.md) and [daily rotation policy](../docs/deployment/secret-rotation.md): Sydney, one API host and Single-AZ RDS; Auto Scaling/Multi-AZ deferred. This document does not by itself prove hosted deployment, live rotation or production acceptance.
<!-- END current AWS platform -->

AWS is BoxVault's primary SaaS infrastructure platform. The selected project Region is **ap-southeast-2 (Sydney)**. Initial topology: **one EC2 API host, private Single-AZ RDS PostgreSQL, private S3 and SES**, with Secrets Manager daily database credential rotation. Auto Scaling and Multi-AZ are deferred.

- [Accepted platform decision](../docs/architecture/aws-platform-decision.md)
- [Complete service map](../docs/deployment/aws-service-map.md)
- [Migration and release boundaries](../docs/deployment/aws-migration.md)
- [Daily rotation and compatibility gates](../docs/deployment/secret-rotation.md)
- [Toolkit configuration and renewal](../docs/deployment/aws-agent-toolkit.md)

## Source locations

`../infra/aws/` contains the CloudFormation application foundation draft and the source of the installed read-only toolkit IAM stack. The application draft is not a deployed backend. `firebase/` retains static mock preview verification and billing guards until AWS cutover is accepted; it is not the primary application runtime.

Do not expose PostgreSQL or private objects publicly. Keep the toolkit identity read-only; use separate scoped runtime, deployment, rotation and migration identities. Preserve all existing local/Neon data. Documentation adoption does not activate live secret rotation or change hosting traffic.
