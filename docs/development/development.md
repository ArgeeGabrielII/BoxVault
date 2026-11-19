# Development workflow

<!-- BEGIN current AWS platform -->
> **Platform policy (2026-11-19):** Follow the [accepted AWS primary-platform decision](../architecture/aws-platform-decision.md) and [daily rotation policy](../deployment/secret-rotation.md): Sydney, one API host and Single-AZ RDS; Auto Scaling/Multi-AZ deferred. This document does not by itself prove hosted deployment, live rotation or production acceptance.
<!-- END current AWS platform -->

AWS is the primary hosted target; local development remains independent. [Accepted platform decision](../architecture/aws-platform-decision.md).

## Connected local application

Requirements: Node.js 22, pnpm 10.18 and PostgreSQL 18 server tools.

```bash
pnpm install --frozen-lockfile
pnpm dev:local
```

Open http://127.0.0.1:5180. Create an account, open Local inbox, verify and sign in. Boxes/items, QR labels and Family controls use the actual local API. The private `.boxvault-local/` database and keys persist across restarts. Do not delete this directory to resolve a busy port; check whether the app is already running. [Full local guide](connected-local-app.md).

The launcher overrides hosted connection variables with its private loopback database, applies seven committed migrations locally and uses a synthetic SMTP sink. Its test-only CAPTCHA mode, local inbox and local Family entitlement helper must not be deployed as production features. It does not rotate the user's local keys or migrate Neon/AWS data.

## Manual API work and hosted configuration

Use `.env.example` only as an untracked manual-development template. Keep `DATABASE_URL`, `AUTH_DATABASE_URL` and `DIRECT_URL` as distinct restricted content, auth and migration connections. For the AWS target, all refer to the same approved private RDS database under different identities; do not point migrations at a customer database casually. Remote connections require verified TLS.

Hosted runtime secrets resolve through Secrets Manager. Daily rotation requires actual database password changes plus Prisma connection refresh. Existing JWT/pepper/TOTP single-key code needs compatibility changes before daily key rollover. [Rotation requirements](../deployment/secret-rotation.md).

Neon connection guides and the real Brevo/reCAPTCHA harness are historical isolated-development references, not default new-environment setup. Preserve their records and safety constraints. Do not reset a historical branch or automatically import its accounts into the owner's fresh AWS database.

## Checks and clients

Run the appropriate typecheck/build and regression suites for a change. Disposable PostgreSQL/SMTP CI validates auth/RLS/Family behavior without hosted provider credentials. Local HTTP checks are documented separately from browser/device acceptance. Docs-only changes require link/consistency checks rather than new implementation-mirroring tests.

For iOS, generate the Xcode project in `apps/ios`; device and Universal Link acceptance remains outstanding. For the mock-only Playground use its dedicated guide/build. Do not connect the Firebase mock artifact to private APIs or add secrets to VITE variables.

## AWS tools

Use `boxvault-restricted` through the AWS MCP server for authorized metadata work; selected Region is Sydney. It cannot deploy or rotate secrets. The separate owner browser-login source is for renewal and explicitly authorized IAM bootstrap, not an application-operation workaround. [Toolkit instructions](../deployment/aws-agent-toolkit.md).
