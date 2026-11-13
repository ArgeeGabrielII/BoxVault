# BoxVault Security-First Engineering Standard

**Implementation snapshot (2026-11-12; PR #4):** These standards remain **mandatory release requirements**, not a claim of production compliance. Some M1 controls are coded (auth/MFA, session replay protections, tenant/ACL RLS, restricted DB roles), and test-only PostgreSQL evidence exists. The real browser tenant-isolation exercise found an unresolved own-tenant HTTP 403; latest-head/complete negative tests, private media/QR/payment controls, recovery/monitoring and independent sign-off are outstanding. **Do not merge PR #4 or deploy for paying customers** on existing evidence. See [roadmap](../planning/delivery-roadmap.md).

**Status:** Mandatory design baseline; **partially implemented in draft M1**, not production approved. **Scope:** React customer/admin web, SwiftUI iOS, NestJS API, PostgreSQL/Prisma, QR/NFC labels, private media, manual payments and home/hybrid hosting.

## 1. Security invariants (must hold for every release)

1. **Deny by default:** APIs expose no tenant content without authentication, authorized membership, object permissions and active entitlement rules.
2. **No cross-tenant data:** a user from Tenant A cannot read, count, search, mutate, download, infer, or receive notifications containing Tenant B data, including when identifiers are guessed or copied.
3. **No administrative browsing:** platform admin application and identities have no inventory/media read permissions. Subscription/diagnostic data must remain separate. **Caution:** infrastructure superusers could still access database or backups; do not claim zero-knowledge encryption.
4. **Private media:** uploaded content resides in private storage; every access, including thumbnails and signed URLs, is independently authorized.
5. **No bearer-label authorization:** a QR/NFC label is a locator, never a credential. Anonymous possession of a label must not disclose an owner or contents.
6. **Financial integrity:** one verified transfer produces no more than one credit posting; retries, races and operator errors must not mint credits.
7. **No secrets or sensitive user content in logs, CI output, version control or analytics.**
8. **Fail closed:** authorization, database context, storage signer and permission checks deny on error. No fallback-to-admin or default-tenant.
9. **Recoverability:** encrypted off-site backups and restoration tests must pass before taking paying customers.
10. **Secure delivery:** no production deployment until automated security gates pass, regardless of feature completion.

## 2. Verification target

Use [OWASP ASVS **5.0.0**](https://asvs.owasp.org/) as the base verification catalog, targeting **Level 2 where applicable** (a project target, not certification) and evaluating relevant higher-assurance controls for identity, payments and media. Include the [OWASP API Security Top 10](https://owasp.org/API-Security/) for BOLA, BFLA, excessive exposure and resource-exhaustion review. Map each verified control to a test case in CI.

Maintain a risk register with severity, owner, control, validation evidence, residual risk, decision and review date. No critical or high risk without approved remediation before public launch.

## 3. Mandatory request authorization design

**Identity → session → tenant membership → action permission → object membership → RLS → private storage**

- Authenticate requests using validated issuer/audience/signature/expiration; never trust decoded claims alone.
- Resolve tenant context from a verified `tenant_members` row (active status); users may belong to several tenants but must select one explicitly.
- Validate target `container.tenant_id`, `item.tenant_id`, `media.tenant_id` and role even when RLS is enabled.
- Prevent mass assignment via DTO allowlists (never accept `tenantId`, `role`, `isAdmin`, `walletBalance` or `subscriptionStatus` as mutable user fields).
- Deny cross-tenant access for list/search/aggregate counts, autocomplete, exports, async jobs and media—not just detail endpoints.
- Apply PostgreSQL RLS to every tenant-owned table: runtime database role has no `BYPASSRLS` and is not owner; use `FORCE ROW LEVEL SECURITY` where appropriate.
- Prisma and connection pools: tenant context must be set with `SET LOCAL`/equivalent **inside the same database transaction** that issues SQL, not session-global state that may be reused.
- Keep schema-migration role distinct from runtime role; no blanket runtime service-role bypass for maintenance.
- Security tests must exercise two tenants with the *same resource IDs in tampered requests* and verify 403/404 without revealing resource existence.

## 4. Authentication and sessions

- Argon2id password hashing with carefully tuned work factors and optional passkey/MFA roadmap.
- Verified email; rate limits on registration/login/reset/invite/QR resolution; generic responses to prevent account enumeration.
- Short-lived access tokens (initial target 5–15 minutes); refresh token rotation, replay detection, hashed server-side refresh credentials, device/session revocation.
- Browser: use `Secure`, `HttpOnly`, appropriate `SameSite` cookie policy; CSRF defense for cookie-authenticated state changes; CSP, HSTS and restricted CORS origins.
- Native iOS: use Keychain for tokens; never UserDefaults/plaintext files for secrets. Use system authentication where feasible and ATS/TLS. Do not disable certificate validation.
- Require step-up MFA/re-authentication for platform finance/admin functions and sensitive account changes.
- Invitation tokens are single use, expire, stored hashed, tied to intended email/tenant; enforce **Family limit of four accounts including owner** under concurrency.

## 5. Private content and scanned labels

- Label URLs include ≥128-bit CSPRNG token; do not contain sequential IDs, account identifiers, item names or image paths.
- Store token hashes when possible, support rotation/revocation and prevent token output in logs/referrers.
- Resolve scan only after session and membership checks; reject invalid/revoked token uniformly.
- Object stores remain non-public. Sign download URL only after object-level authorization; make URLs short-lived, bind to expected object/method, avoid caching across user accounts.
- Validate upload MIME based on magic bytes and successful image decoding, limit bytes/dimensions/count, strip EXIF geolocation, generate trusted thumbnails, and quarantine unsafe files.
- Never process user-controlled arbitrary external URLs for image retrieval (SSRF risk).
- Local iOS caches: data protection class and purge on logout or access revocation; member removal invalidates download rights.
- Backups and generated thumbnails have the same privacy classification as originals.

## 6. Payments and admin isolation

- All bank QR instructions, receipt uploads, top-ups, wallet views and credit redemption stay in **React web only**. Native app exposes **neutral entitlement status only**.
- Finance reviewer must confirm receipt from actual receiving-bank transaction history; user-submitted screenshot cannot independently establish payment.
- Financial ledger is append-only and reconciled; approval uses transaction+row lock, unique payment-source and idempotency constraints. Approval/rejection logged with actor, timestamp and reason.
- Separate `PLATFORM_ADMIN` from tenant roles. Least-privilege `PAYMENT_REVIEWER`, `FINANCE_READ`, `SUPPORT_READ`, `SECURITY_AUDIT` permissions; consider dual approval for reversals/high-value credits.
- Admin API must not expose content/thumbnail searching. Use separate database role/storage identity for safe admin metadata, with no content read grants.
- Subscription owner can authorize redemption; editor/viewer cannot manipulate credits. Maintain audit trail for manual adjustments.

## 7. Logs, telemetry and safe support

**Allowlist:** correlation ID, timestamp, route template, status, duration, error code, safe actor/tenant pseudonymous IDs, stored-byte totals, transaction state. **Never record:** full JWT/refresh tokens, passwords, QR/NFC raw tokens, item names, container descriptions, customer photos, signed URLs, bank account number, transfer receipt bytes or request/response bodies.

A troubleshooting workflow uses redacted logs and customer-provided correlation IDs. If reproduction is needed, use synthetic fixtures or a customer-controlled export instead of an administrator content bypass. Configure retention, access monitoring and secure deletion.

## 8. CI/CD controls

Required PR checks:
- TypeScript/Swift build, unit tests, lint/type checks.
- SAST, dependency and lockfile vulnerability scanning, secret scanning and license review.
- Database migration validation including RLS smoke tests.
- Two-tenant integration/security tests on all endpoints and media flows.
- Auth regression tests: wrong-role, expired/revoked token, refresh replay, invitation race.
- Financial concurrency tests: duplicate approval, duplicate transfer, simultaneous redemption, crash after ledger entry, rollback and idempotent retries.
- Automated checks for missing `@UseGuards` or approved public-route declarations; explicit security reviewer for endpoint/permission/DB migration changes.
- No production secrets in pipeline logs, artifacts or Git history.

Required before public launch: external penetration test/security review proportionate to exposure, restore drill, incident runbook, security contacts and privacy/legal review.

## 9. Home and hybrid hosting security gate

**Preferred for paid production:** hybrid or managed private media service with off-site database backup; home-only is a pilot option with explicit downtime and recovery assumptions.

If home-hosted: router and server OS patched, management VLAN, no public PostgreSQL/SSH, no UPnP port exposure, dedicated service user, host firewall, MFA for remote administration, hardened tunnel with origin access restrictions, UPS, ISP redundancy strategy, disk encryption, backup immutability and restore drills. Cloudflare/Tunnel does not protect against physical theft, malware or power/network loss.

Document validated RPO/RTO and do not advertise an availability SLA until real monitoring supports it.

## 10. Definition of Done for every feature

Security acceptance required before merge:
1. Risk classification and trust-boundary diagram updated.
2. AuthN, tenant scope, role, object-level and RLS policies defined.
3. Test cases for unauthorized, wrong-tenant, revoked and expired access.
4. Data classification and retention of new fields documented.
5. Logs checked for sensitive payloads; audit events use allowlist.
6. Rate/resource limits, idempotency, concurrency and failure modes tested.
7. Secure dependencies, secret handling and migration rollback reviewed.
8. Relevant docs, OpenAPI contracts and threat model updated.

**Current status:** These are architectural requirements; the M1 feature branch has some protected flows and scoped test evidence, but does not yet satisfy the full security release gate. **Do not deploy it for paid customers** until the release gate is satisfied.
