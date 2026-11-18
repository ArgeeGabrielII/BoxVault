# ID-03 — Family invitations and membership management

**Updated:** 2026-11-18 (Asia/Manila). **Engineering state:** implemented; local and commit-scoped GitHub automated verification recorded below. **Production acceptance:** NOT APPROVED. CI evidence is recorded for specific commits and does not authorize runtime deployment, hosted database migrations, or accepting customers.

This is the current feature/status reference. Older PR #4 branch-only and merge-hold passages are historical: the owner authorized source consolidation into `main`. The earlier own-tenant 403 was superseded by the 2026-11-13 operator-observed 401/200/403 retest. Neither that smoke test nor later CI constitutes full M1 production approval.

## Scope and API

All paths have `/api/v1` prefix. AccessGuard verifies signed JWT and live session first. Successful responses use `{data: ...}` with `Cache-Control: no-store`.

| Method | Route | Behavior |
|---|---|---|
| GET | `/tenants` | Up to 100 active own workspaces, membership role, neutral Family-eligibility flag. Does not expose other tenants. |
| GET | `/tenants/:tenantId/members` | Owner-only active member IDs, email and role; no inventory. `memberId` in mutation routes means TenantMember.id. |
| GET | `/tenants/:tenantId/invitations` | Owner-only latest 100 invitation summaries. Derived EXPIRED status; never proof hashes. |
| POST | `/tenants/:tenantId/invitations` | Owner invites `{email,role: EDITOR|VIEWER}`; active Family entitlement required. Unknown body fields rejected. |
| DELETE | `/tenants/:tenantId/invitations/:invitationId` | Owner cancels a pending/expired invitation; repeat cancellation is idempotent. Accepted invitations cannot be canceled. |
| POST | `/invitations/accept` | `{token}` plus a live verified-email session; email must match intended recipient. Invalid/expired/canceled/replayed/wrong-recipient proofs return the same neutral 404. |
| PATCH | `/tenants/:tenantId/members/:memberId` | Owner changes Editor/Viewer role. Changed roles revoke that member's existing sessions; no owner promotion/transfer here. |
| DELETE | `/tenants/:tenantId/members/:memberId` | Owner removes a non-owner who owns no containers; membership soft-revoked, selected grants deleted and sessions revoked. |

Unauthorized tenant/object access is neutral 404; unauthenticated sessions are 401; malformed input is 400; business conflicts are 409; throttling is 429. SMTP/database failures return safe service-unavailable errors, without SQL payloads.

## Product and privacy decisions

- A Family workspace is identified by an existing ACTIVE Subscription for Plan code FAMILY, maxMembers at least four, and a future validUntil. Eligibility is read server-side. No tenant-create, paid activation, wallet, payment or subscription mutation endpoint is added. Tests provision synthetic entitlements with the disposable fixture identity only.
- Four seats total, including the owner. Pending unexpired invitations reserve seats. Duplicate pending email is rejected; expired/canceled invitations release their reservation. The same tenant lock serializes creation, acceptance, cancellation and membership changes, across API processes.
- Invitations last seven days. Generate 32 CSPRNG bytes; store only HMAC-SHA256 with an invitation-specific domain separator and the existing session pepper. Rotating that pepper invalidates outstanding invitation proofs. Accept consumes the invitation and activates membership in the same transaction.
- Deliver the raw proof only in an email fragment (`/accept-invitation#token=...`), never in JSON, query parameters, audit fields, metadata or logs. This ID-03 phase originally reserved that client route; the subsequent [connected local web app](../../development/connected-local-app.md) consumes it. Hosted web/iOS client acceptance remains pending. A client must read the fragment into volatile memory and POST the proof after real authentication. Firebase remains the disconnected mock UI.
- Registration still creates a separate personal workspace. Joining a family adds another membership and does not convert or delete the personal workspace.
- Cancel/role/removal management stays available when the Family subscription expires; new invitations and acceptance require an active entitlement. General inventory subscription/quota enforcement is a separate workstream.
- Owner membership cannot be demoted, removed or transferred by these endpoints. A member who owns any container cannot be removed: return ID03_MEMBER_OWNS_CONTAINERS. No automatic reassignment, deletion, or private-content exposure to the family owner occurs. Transfer/archive policy needs a separately reviewed feature.
- Role changes and removal revoke all existing sessions for that user, including sessions used for other workspaces. The user can sign in again for their remaining memberships. Rejoining never resurrects historical selected-container grants.
- Private/selected/all-family RLS semantics are unchanged. A family owner has no implied access to another member's private containers. Removed users are denied child item/media rows by the existing parent-aware policies. Private media HTTP URLs/caches remain a separate, unimplemented acceptance area.
- Invitation email is personal data, visible only through owner-scoped management or the intended email delivery. FamilyAuditEvent holds only event kind, actor/tenant/optional target/invitation IDs and time; no email, proof, container names or content. Runtime cannot directly read or alter invitation/audit tables. Production retention/deletion policy and cleanup jobs remain a release decision; no automatic retention period is claimed.

## Database and runtime boundaries

Migration `202611180006_family_membership` adds FamilyInvitation and FamilyAuditEvent, both FORCE RLS with no direct runtime policies, plus narrowly scoped security-definer entrypoints. Internal helpers are not executable by runtime. Every entrypoint rechecks live verified session; owner operations recheck active OWNER membership. Fixed pg_catalog search_path, fully qualified tables and revoked PUBLIC execution prevent search-path/public-function escalation. No broader User/AuthSession table grants are added to content runtime.

Run the migration with the migration identity, never app runtime. Apply only the explicit eight entrypoint grants shown in `apps/api/test/family-runtime-grants.fixture.sql`, substituting a separately reviewed deployment role. That fixture file is for disposable CI only; this change does not apply hosted grants or migrate any Neon branch. Review security-definer ownership and BYPASSRLS behavior before a hosted rollout, consistent with the existing M1 helper design.

Inventory reads take a shared per-tenant transaction advisory lock; container creation/sharing and membership mutations take the matching exclusive lock. Membership validation follows lock acquisition. This prevents removal from racing a new privately owned container through the API. All actor/session context is transaction-local.

The first positive create/share HTTP exercise exposed a pre-existing INSERT RETURNING/RLS statement-snapshot failure. Container creation now checks active editing role and performs one INSERT without RETURNING, returning a server-generated ID and PRIVATE mode. The INSERT policy itself is unchanged. This is covered by real owner/Editor success, Viewer denial and create/remove race tests.

SMTP runs outside database locks, with bounded connection/greeting/socket waits and finally-close cleanup. A delivery error attempts to cancel its pending invitation; already accepted invitations are not rolled back. Provider uncertainty, revocation during delivery, retries and live operations require further review before a customer rollout. There is no durable mail outbox or background retry worker in this phase.

## Verification evidence and limits

Local tests use a newly initialized PostgreSQL 18 cluster on literal loopback, separate migration/content/auth roles and synthetic SMTP only. No persistent Neon, production user, schema or grant is changed. Database sessions are UTC, as required by the pre-existing timestamp-without-time-zone auth schema.

Commands executed against those fixtures:

- Apply all seven committed migrations and compare Prisma schema: no drift.
- `test:authz:e2e`: 12 passed; onboarding-negative suite: 1 passed; CAPTCHA integration suite: 1 passed.
- `test:auth-http:contract`: 10 passed, including real SMTP registration/verification/reset, MFA and refresh/reuse handling.
- `test:family:http`: 17 lifecycle/negative/concurrency cases inside one parent test (18 TAP passes). Six distinct users register, receive verification mail and sign in through HTTP; no pre-made JWT shortcut.
- Typecheck/build pass locally; the existing dependency SMTP/TLS and CLI suite is also retained in CI.

ID-03 cases cover own-only tenant selection, owner-only management, recipient binding, expired/replayed/canceled proof, body/role tampering, cross-tenant IDs, duplicate invites, four-seat reservation/acceptance, simultaneous different acceptances, same-proof races, role downgrade, ownership-removal block, concurrent create/remove, session and grant revocation, rejoin without grant resurrection, child-item/media RLS, failed SMTP delivery, audit privilege separation and throttling.

**Still not accepted for production:** real invitation UI/client integration, live provider verification, hosted migration/least-privilege ownership review, production entitlement provisioning, private-media/QR/cache authorization, broader M1 controls, independent security review and explicit release sign-off. Keep automated evidence and release approval separate.

## GitHub engineering evidence — feature commit d119dc0

All checks passed for source commit `d119dc028d82ac0ef6dc2b9cbeeda3f6dd97a6c6` in [PR #12](https://github.com/ArgeeGabrielII/BoxVault/pull/12):

- [CI](https://github.com/ArgeeGabrielII/BoxVault/actions/runs/44219376987): build/typecheck, production dependency audit, mailer TLS/CLI regression checks, QR and Playground builds.
- [M1 Postgres Authorization Gate](https://github.com/ArgeeGabrielII/BoxVault/actions/runs/44219377010): all seven migrations, Prisma no-drift check, restricted roles, onboarding/CAPTCHA, authentication HTTP and ID-03 HTTP/concurrency suites.
- [M1 PostgreSQL Authorization Gate](https://github.com/ArgeeGabrielII/BoxVault/actions/runs/44219377250): independent disposable-database RLS suite.
- [CodeQL](https://github.com/ArgeeGabrielII/BoxVault/actions/runs/44219373470): Actions and JavaScript/TypeScript analysis passed. No new open feature-branch code-scanning findings were returned.

This is automated engineering verification for that exact code-bearing commit. Subsequent documentation/merge heads have their own CI lifecycle. **No production approval, hosted migration, live SMTP/client invitation flow or security sign-off is inferred.**

Rollback preparation for a future hosted release: disable the family routes and revoke their explicit entrypoint grants if necessary; retain invitation/audit records and use a reviewed forward migration. Do not automatically drop tables or rewrite membership history as a rollback mechanism.
