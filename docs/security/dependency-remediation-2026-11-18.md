# Dependency security remediation — 2026-11-18

This follows the [GitHub alert verification](github-alert-review-2026-11-18.md). The six CodeQL findings were already resolved (five fixed, one verified false positive); this change addresses the separate package audit.

## Audit result

| Audit | Before | After |
| --- | --- | --- |
| All workspace dependencies | 25 findings: 7 high, 17 moderate, 1 low | 2 high findings, both Picomatch development-tool paths |
| Production dependencies only | Not separately recorded in the baseline | 0 findings |

These are registry audit results as of the date above, not a guarantee that all dependencies are vulnerability-free. No advisory is ignored or suppressed. The initial GitHub review received an alerts-disabled response; during this remediation the endpoint began returning Dependabot alerts. CI now runs `pnpm audit --prod --audit-level=low` to catch reported production-dependency vulnerabilities independently.

## Changes

- Upgrade the API's Nodemailer from 7.0.13 to 10.6.0 and its TypeScript definitions to 8.0.2. Nodemailer 10 requires Node 20 or newer; the project CI uses Node 22. The existing SMTP transport and text-message interface typecheck with these definitions. The [upstream release](https://github.com/nodemailer/nodemailer/releases/tag/v10.6.0) is published; registry audit no longer reports the mailer findings.
- Pin the Prisma config dependency `deepmerge-ts` to 8.0.2 using a parent-scoped pnpm override. Prisma itself remains 6.19.3, preserving the existing schema/migration workflow. The upstream major adds circular-reference handling and changes Map merging; this project uses the schema/env-based configuration, and client generation/build checks pass. Remove the override when Prisma adopts a patched version.
- Pin the Nest CLI's `glob` dependency to 14.0.6 with a parent-scoped override. Its compatible dependency resolves `minimatch` to 11.0.9. Keep Nest CLI on its existing major. Remove the override when the CLI adopts a patched dependency.
- Commit the updated pnpm lockfile so local and CI installations use the same resolutions.

## Compatibility and security checks

The dedicated `pnpm --filter @boxvault/api test:dependency-security` script tests actual library behavior with disposable local fixtures:

1. Verification and password-reset messages reach a synthetic loopback SMTP sink with their expected links. No external mail is sent.
2. In production mode, an SMTP server without STARTTLS is rejected even when the loopback test flag is present. Neither SMTP authentication credentials nor message/action-token data is sent before TLS.
3. The patched Nest CLI builds a temporary project, copies nested template assets and honors exclusions, including paths containing spaces.

All three tests pass locally. They are added to CI after the API build. Prisma client generation, API typecheck/build, the public web build, Playground typecheck/build and both static artifact audits also pass locally. The existing database-backed GitHub gate additionally validates schema migrations, onboarding, verification email, password recovery, session rotation, MFA and tenant authorization. All five GitHub workflows passed for remediation commit `e6fcbbd`: CI (including the production audit and new regression tests), CodeQL, both PostgreSQL authorization gates, and Firebase UI/Playground deployment.

## Remaining Picomatch findings

[GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) lists Picomatch through 4.0.7 as affected and **no patched release**, verified against the registry and advisory on 2026-11-18.

Affected paths:

- API development tools: Nest CLI → Angular DevKit → Picomatch 4.0.4.
- Playground development tools: Vite → Picomatch 4.0.7.

The issue requires attacker-controlled repeated-extglob patterns. Application routes do not call Picomatch or accept glob patterns. These packages are absent from the production-only dependency audit and are not server processes in the Firebase static deployment. Playground development is bound to `127.0.0.1`; do not expose development tooling or feed untrusted glob configuration to it. This limits exposure but does not patch the dependency, and the two findings stay visible in full audits.

Resolution remains to adopt a reviewed upstream fix when available, or replace the affected tooling with a compatible alternative. Do not force an older affected version, hide the advisory, or claim a clean full audit.

## GitHub indexing verification

GitHub's dependency-graph SBOM now lists the patched versions (Nodemailer 10.6.0, deepmerge-ts 8.0.2, glob 14.0.6 and minimatch 11.0.9), matching the committed lockfile. Its alert API initially still returned 44 open records, including duplicate Nodemailer advisories for the package manifest and lockfile, while alert reconciliation was pending. These are not 44 additional vulnerabilities discovered by the current package audit. No Dependabot alert was manually dismissed to change the count. Picomatch remains an actual unresolved advisory.
