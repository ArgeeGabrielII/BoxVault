# Agent Toolkit for AWS: installed configuration

<!-- BEGIN current AWS platform -->
> **Platform policy (2026-11-19):** Follow the [accepted AWS primary-platform decision](../architecture/aws-platform-decision.md) and [daily rotation policy](secret-rotation.md): Sydney, one API host and Single-AZ RDS; Auto Scaling/Multi-AZ deferred. This document does not by itself prove hosted deployment, live rotation or production acceptance.
<!-- END current AWS platform -->

Verified 2026-11-19 (Asia/Manila). Setup completed on this Mac for Codex and Kiro using the [official setup instructions](https://raw.githubusercontent.com/aws/agent-toolkit-for-aws/refs/heads/main/setup-instructions/setup.md).

## Project and access

- New AWS experience, project Region **Sydney (`ap-southeast-2`)**.
- Tool profile **`boxvault-restricted`**, assuming **`BoxVaultToolkitReadOnly`** under the `/boxvault/` IAM path.
- One-hour restricted role sessions; source browser authentication is separate.
- Guidance preference **HIGH**: explain steps, alternatives and best practices. This is saved in project rules.
- AWS API reports the Free plan is **ACTIVE**, with **USD 200** remaining credits at verification. This is a timestamped observation, not a permanent balance or price guarantee.

The restricted profile has a specific metadata allowlist: own identity; Sydney RDS instance/engine/orderability, SES account/identity, availability-zone and template-validation metadata; global Free Tier plan and budget metadata. Every other AWS action is explicitly denied. The permissions boundary repeats that maximum scope. It cannot create/update/delete application resources, send email, read secrets, read/write S3 objects, administer IAM, assume further roles or upgrade the plan.

`Resource: "*"` in this policy is limited to the explicitly named metadata APIs; it is not a wildcard grant for all services. Regional metadata calls are constrained to Sydney. Knowledge/catalog access does not require AWS API permissions under the toolkit's current authorization model.

The stack **`boxvault-toolkit-access`** contains only the managed policy and role. Its source is [toolkit-access.json](../../infra/aws/iam/toolkit-access.json); the standalone policy is [toolkit-readonly-policy.json](../../infra/aws/iam/toolkit-readonly-policy.json). Trust is limited to the verified managed project owner role in the same project, with a `boxvault-toolkit-*` role session name. This is not a human console user or a general deployment identity.

## Installed files

The installer added 25 default skills per detected tool:

- Codex skills: `~/.agents/skills/`.
- Kiro skills: `~/.kiro/skills/`.
- Codex MCP: `~/.codex/config.toml`, `mcp_servers.aws-mcp`.
- Kiro MCP: `~/.kiro/settings/mcp.json`, `mcpServers.aws-mcp`.
- Project guidance: `AGENTS.md` and `.kiro/steering/aws-agent-toolkit.md`.

Both MCP entries set `AWS_MCP_PROXY_PROFILES=boxvault-restricted`. The generated command/arguments remain unchanged. Existing Neon and Node REPL integrations were preserved. No passwords, long-term access keys, session tokens or database secrets were placed in repository files.

Restart Codex/Kiro and open a new session to load the new connection and skills. A useful first request is: “Inspect BoxVault's AWS migration readiness using the restricted profile. Do not deploy resources.” The user can choose their actual next task instead.

## Credential renewal and limits

The browser-login source was moved to **`boxvault-bootstrap-owner`**, separate from the MCP allowlist. To renew it from Terminal:

```bash
aws login --profile boxvault-bootstrap-owner --region ap-southeast-2
aws sts get-caller-identity --profile boxvault-restricted --region ap-southeast-2
```

The second command must identify `assumed-role/BoxVaultToolkitReadOnly/`, not `AccountFullAccessRole`. Do not run `aws login` directly on the restricted role profile: that could replace its role-based configuration with a broad browser-login identity.

The owner bootstrap profile remains privileged and is available to the computer's operator. Restricting the MCP connection does not sandbox every possible Terminal command on this Mac. It must not be exposed to MCP or used by application runtimes. An agent should use it only for explicit owner-authorized IAM bootstrap or credential renewal, not as an AccessDenied workaround.

To use a different project later, authenticate an appropriately restricted identity and deliberately update the space-separated MCP profile allowlist; restart the tool afterward. Do not add the owner profile as a shortcut. Deployment will need a separate task-specific role; keep this tooling role read-only.

## Evidence and remaining work

- STS verified the restricted assumed-role ARN and IAM GetRole verified the boundary.
- Access Analyzer policy validation returned no findings.
- Structured IAM simulation passed intended reads and explicitly denied critical writes, secrets, object access and escalation.
- A live Sydney RDS metadata read succeeded; IAM ListRoles returned an explicit deny. No secret/object retrieval or mutating API was invoked to test negative access.
- MCP proxy initialized and returned the complete tools list, including documentation search and skill retrieval.
- AWS skill catalog query completed and installed-skill registry/files were checked.
- Existing MCP configuration was compared with its private pre-install backup. An omitted Node REPL args value was restored.

No RDS database, S3 media bucket, SES identity, application host, paid-plan upgrade or application cutover was created by toolkit setup. Local BoxVault and Neon records remain in place. The [application migration](aws-migration.md), real email, private uploads and hosted production acceptance are separate unfinished work.
