# GitHub security alert verification — 2026-11-18

Reviewed repository: `ArgeeGabrielII/BoxVault`, main revision `51336a7c0f1ca80846079652a3f68f7fd06c0dea`.

## GitHub alerts

Six open CodeQL alerts were returned by the authenticated GitHub API. No open secret-scanning alerts were returned. Dependabot's alerts endpoint reported that alerts are disabled; an empty dependency-alert list must not be inferred from that response.

| Alert | Verification | Resolution |
| --- | --- | --- |
| [1](https://github.com/ArgeeGabrielII/BoxVault/security/code-scanning/1) | CI workflow lacks an explicit token-permission limit. | Set workflow-level `permissions: contents: read`. |
| [3](https://github.com/ArgeeGabrielII/BoxVault/security/code-scanning/3), [5](https://github.com/ArgeeGabrielII/BoxVault/security/code-scanning/5) | Both jobs in the M1 authorization workflow inherit unspecified token permissions. | Set the same read-only permission limit for both jobs. |
| [4](https://github.com/ArgeeGabrielII/BoxVault/security/code-scanning/4) | Prisma baseline workflow lacks an explicit token-permission limit. | Set `permissions: contents: read`; generating SQL/artifacts requires no repository writes. |
| [2](https://github.com/ArgeeGabrielII/BoxVault/security/code-scanning/2) | Case-sensitive script-tag regexp is a **test assertion**, not a sanitizer. `renderLabelSvg` already escapes XML delimiters in title, subtitle and reference. No executable label-injection path was reproduced. | Strengthen the assertion and test lower/upper/mixed-case tags across all three fields, plus image tags, quotes and ampersands. |
| [6](https://github.com/ArgeeGabrielII/BoxVault/security/code-scanning/6) | False positive: the cookie value is an opaque 48-byte CSPRNG session handle. It contains no password, password hash, identity or serialized user record. CodeQL propagates sensitivity from the result of `passwordLogin`. | Retain the intended session design; document it and assert cookie shape, JSON exclusions and `no-store` in the existing database-backed HTTP contract test. |

### Refresh-cookie evidence

`AuthService.issue` generates `randomBytes(48).toString('base64url')`. `AuthSession.refreshTokenHash` stores HMAC-SHA256 with the configured session pepper. `AuthController.publish` places the opaque handle only in an HttpOnly, SameSite=Strict cookie scoped to `/api/v1/auth`, with Secure enabled in production and `Cache-Control: no-store`. Refresh rotates the handle; reuse detection revokes the session. The JSON response contains an access token, expiry and token type, never the refresh handle or password.

This is the opaque lookup-key design recommended as an alternative to storing sensitive data by [CodeQL's query guidance](https://codeql.github.com/codeql-query-help/javascript/js-clear-text-storage-of-sensitive-data/). Encrypting the same bearer handle would not prevent replay if its cookie were stolen. Production HTTPS and cookie protections remain necessary. The public Firebase release contains no running API, real login or refresh cookie flow.

## Separate dependency audit

The findings below are the baseline before dependency remediation. See the [dependency follow-up](dependency-remediation-2026-11-18.md) for patched versions and the remaining unpatched issue.

`pnpm audit --json` against the committed lockfile returned **25 findings: 7 high, 17 moderate, 1 low, 0 critical**. These are dependency findings, not additional open GitHub CodeQL alerts or proof that all vulnerable options are reachable.

| Dependency | Locked versions | Location / exposure |
| --- | --- | --- |
| nodemailer | 7.0.13 | API email delivery; direct runtime dependency. Most findings concern SMTP/address parsing, TLS or specific message/transport options. Requires a separately tested major-version upgrade and SMTP regression tests before a real backend launch. |
| deepmerge-ts | 7.1.5 | Prisma CLI configuration dependency; development tooling. Recursive-object stack exhaustion; advisory lists 8.0.0 as the first patched version. |
| glob | 13.0.6 | Nest CLI development dependency; cancellation/traversal issue. Advisory lists 14.0.2 as patched. |
| minimatch | 10.2.6 | Nest CLI → glob; development matching/DoS issue. Advisory lists 11.0.1 as patched. |
| picomatch | 4.0.4, 4.0.7 | Angular/Nest CLI and Vite development matching; ReDoS. Audit reported no patched range for GHSA-fc5q-39xc-vjpf. |

Dependency upgrades are not included in the alert-triage patch: they involve major-version compatibility decisions and cannot be represented as verified merely by changing version numbers. This report does not claim a clean dependency audit. The static Hosting release excludes the API and server development tools.

## Validation

- QR regression suite: five tests passed, including the expanded injection corpus.
- API Prisma client generation, TypeScript check and build run separately.
- The existing disposable-PostgreSQL GitHub Actions gate executes the strengthened HTTP authentication contract; no real Neon data or credentials are required.
- CodeQL must reanalyze the new main revision before the permission/test alerts can be reported fixed in GitHub. No query is disabled or excluded by this patch.
