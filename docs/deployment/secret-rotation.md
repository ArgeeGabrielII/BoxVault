# BoxVault daily secret rotation

<!-- BEGIN current AWS platform -->
> **Platform policy (2026-11-19):** Follow the [accepted AWS primary-platform decision](../architecture/aws-platform-decision.md) and [daily rotation policy](secret-rotation.md): Sydney, one API host and Single-AZ RDS; Auto Scaling/Multi-AZ deferred. This document does not by itself prove hosted deployment, live rotation or production acceptance.
<!-- END current AWS platform -->

Owner requirement recorded 2026-11-19 (Asia/Manila): keep the initial deployment to one API host and Single-AZ RDS; defer Auto Scaling and Multi-AZ. Require daily credential rotation. This document and the infrastructure draft are preparation; **no live secret or local key was rotated**.

## Scope by secret type

| Type | Rotation design | Current implementation state |
| --- | --- | --- |
| RDS master/migration password | RDS-managed secret in Secrets Manager, daily schedule | `data-foundation.json` includes `DatabaseMasterDailyRotation`; undeployed. Never give the master credential to NestJS. |
| Restricted content database password (`DATABASE_URL`) | Daily Secrets Manager database rotation with a dedicated, narrowly scoped Lambda and database permissions | Not implemented/deployed. Must change the actual PostgreSQL password and the secret together, then test a connection. Runtime must refresh its Prisma datasource/pool. |
| Restricted auth database password (`AUTH_DATABASE_URL`) | Same daily rotation, separate secret and database identity | Not implemented/deployed. Rotation must preserve restricted grants and RLS; never replace this user with the master user. |
| SES sending credentials | Prefer the SES API with an EC2 instance role and automatically refreshed temporary credentials | Requires replacing the existing SMTP-only mail transport for AWS. No static SMTP password needs daily rotation in this design. If SMTP is retained, changing a stored random password alone does not change SES credentials; a separate credential lifecycle is needed. |
| AWS deployment credentials | GitHub OIDC / short-lived role sessions | A future deployment-role task; do not create static keys to rotate every day. |
| JWT signing key (`AUTH_ACCESS_JWT_KEY`) | Versioned signing keys, key identifier, current signer plus previous verification key for valid token lifetimes | Daily issuance-key rollover requires application changes. Current code has a single HS256 key and does not support safe overlap. No automatic overwrite is enabled. |
| Session/email/invitation/recovery pepper (`AUTH_SESSION_PEPPER`) | Purpose-separated, version-aware HMAC verification and a migration/retirement strategy | Not rotation-ready. Replacing the one existing pepper breaks refresh sessions, emailed proofs, Family invitations and recovery codes. Recovery codes may outlive normal sessions, so a fixed short overlap alone is insufficient. Plan replacement/consumption of old codes and retirement of old key versions explicitly. |
| MFA encryption key (`TOTP_ENCRYPTION_KEY`) | Key-version-aware decryption plus re-encryption of stored TOTP factors before retiring old keys; preferably envelope encryption | Not rotation-ready. The current code reads one key; changing it blindly prevents decryption. KMS backing-key rotation is not equivalent to replacing this application AES key and does not automatically migrate the stored ciphertext. |
| Third-party OAuth/CAPTCHA secrets, if retained | Follow provider-specific renewal APIs and staged replacement | No generic random-value rotation: the upstream provider must accept the replacement. |

Daily rotation is the target for rotatable stored credentials. The daily application cryptographic-key policy is gated on the corresponding compatibility/migration implementation. Do not silently claim those keys rotate today, and do not disable MFA or invalidate all recovery material to meet a schedule checkbox. End-user passwords are not infrastructure secrets and are not forcibly changed daily by this policy.

## Schedule and cost

The RDS-managed master schedule in the draft is:

```json
{
  "ScheduleExpression": "rate(1 day)",
  "Duration": "1h"
}
```

Secrets Manager rate schedules in days start their rotation window at 00:00 UTC. This corresponds to **08:00–09:00 Asia/Manila** for the proposed one-hour window; it is a window, not an exact execution minute. Use an explicit UTC cron expression if a different daily window is selected later. Application-user schedules should be staggered and tested rather than rotating every dependent credential simultaneously.

RDS-managed master rotation does not need a customer-maintained rotation Lambda. Restricted application users need their own rotation implementation. Keep any Lambda and network connectivity in Sydney. A Lambda in private subnets needs a path to Secrets Manager as well as PostgreSQL; price the required interface endpoint or other approved egress path. Do not add a NAT gateway or paid features automatically. Secrets, API requests, Lambda, network endpoints and alarms can consume credits; daily rotation is not a zero-cost guarantee.

The draft requests waiting for the scheduled window on schedule updates (`RotateImmediatelyOnUpdate=false`). Creation/validation behavior and the managed rotation path still require deployment acceptance on the fresh database. Do not treat CloudFormation template validation as proof that a password has changed or that a rotation has succeeded.

## Runtime and security requirements

1. Store separate master, auth and content secrets; runtime gets only its required secret ARNs. Rotation identities get only the corresponding secret-version operations and database changes. Keep the toolkit role read-only and never use its owner source as a denied-operation workaround.
2. Do not request secret values in chat, source control, logs or CLI output. Credentials should resolve directly into the runtime through approved secret-provider mechanisms.
3. Update the backend: current Prisma clients capture database URLs at construction. A rotated value in Secrets Manager does not update an existing process's environment or pool. Use bounded caching, refresh on an observed version change, a tested datasource/pool replacement strategy and a controlled reconnect path.
4. Do not retry an ambiguous failed write automatically. Retrying after an authentication failure before a transaction starts differs from replaying a possibly committed financial or invitation mutation.
5. Choose and test single-user rotation with coordinated refresh, or alternating-user rotation. Alternating users must preserve the exact SQL grants, RLS flags and role restrictions; do not assume cloned users inherit all future permission changes. One API instance can still experience a brief interruption; zero downtime has not been established.
6. Alarm on rotation failure/overdue rotation, runtime authentication failures and unavailable credential versions. Log secret identifiers/version IDs and outcomes only, never passwords, tokens or ciphertext payloads. Use CloudWatch/EventBridge/SNS delivery as appropriate for the selected implementation; creating a schedule alone does not create these alarms.
7. Define rollback before enabling: if the target password changed, changing only a staging label or blindly restoring an old secret may not restore access. Verify the target and secret agree and retain authorized recovery access separately.

## Acceptance before claiming daily rotation works

- The fresh RDS database and separate restricted identities exist, with the approved grants and policies.
- Rotation changes the real database password, publishes the correct current version, and a fresh connection succeeds; the old password cannot open a new connection after the chosen transition completes.
- No rotation step grants the API master access, BYPASSRLS, table ownership or broader tenant/content access.
- Signup, verification, login/MFA, reset, items, sharing, invitations and revocation work across a rotation and a full app restart.
- Failed rotation raises an alert and follows a tested recovery procedure.
- JWT overlap, pepper-version migration and TOTP re-encryption are separately tested before their daily rollover is enabled.
- Scheduled completion is observed over at least two daily windows, in addition to an explicit controlled rotation test.

At this checkpoint only the **master-secret schedule is represented in the undeployed RDS draft**. Runtime rotation Lambdas, backend secret refresh, key versioning, alarms and live acceptance remain unfinished. There is no live RDS application database to enable this against yet; the current read-only tooling profile is intentionally not authorized to create or rotate secrets.

## Primary references

- [Rotation schedules and UTC windows](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotate-secrets_schedule.html)
- [RDS-managed passwords and rotation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-secrets-manager.html)
- [Managed rotation versus application-user rotation](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotate-secrets_managed.html)
- [CloudFormation RotationSchedule](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-secretsmanager-rotationschedule.html)
