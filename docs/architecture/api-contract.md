# Proposed REST API Contract

<!-- BEGIN current AWS platform -->
> **Platform policy (2026-11-19):** Follow the [accepted AWS primary-platform decision](aws-platform-decision.md) and [daily rotation policy](../deployment/secret-rotation.md): Sydney, one API host and Single-AZ RDS; Auto Scaling/Multi-AZ deferred. This document does not by itself prove hosted deployment, live rotation or production acceptance.
<!-- END current AWS platform -->

**Implementation snapshot — 2026-11-18:** Auth/MFA, registration/verification/reset, session controls, guarded container list/detail/private creation/sharing and the deny-by-default admin top-up route are implemented in consolidated source. ID-03 adds the eight tenant/invitation/member routes documented in the [current audit](../audit/api/id03-family-membership.md). Their scoped automated evidence does not establish complete client integration or production acceptance. QR/media CRUD, financial services and most remaining table entries are still proposals.

**Contract status:** a mixture of implemented and proposed routes. The old statement that main contains only `/health` is superseded. The hosted Firebase release still has no connected application backend.

## 1. Conventions

Base path: `/api/v1`. JSON UTF-8, HTTPS only in production. Bearer access token for protected APIs, verified JWT claims plus server-side membership authorization. Cursor-based pagination (`limit`, `cursor`), with conservative defaults and limits. All mutations validated with NestJS DTOs and `class-validator`. Use OpenAPI as source of truth, generating TypeScript and Swift clients.

Common response envelope (proposed):

```json
{
  "data": { "id": "uuid", "name": "Holiday Decorations" },
  "meta": { "requestId": "req_123" }
}
```

Common error (no private information exposed):

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Resource not available",
    "requestId": "req_123"
  }
}
```

Recommended error codes: `VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `RESOURCE_NOT_FOUND` (404), `CONFLICT` (409), `PLAN_LIMIT_REACHED` (409), `INSUFFICIENT_CREDITS` (409), `RATE_LIMITED` (429). For label resolution, return a neutral response that does not confirm another household's existence.

## 2. Auth / user / tenant routes

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Liveness, currently implemented |
| POST | `/auth/register` | Public, rate limited | Register personal identity |
| POST | `/auth/verify-email` | Token | Verify email |
| POST | `/auth/login` | Public, rate limited | Login + session |
| POST | `/auth/refresh` | Refresh session | Rotate refresh credential |
| POST | `/auth/logout` | User | Revoke current/all sessions |
| POST | `/auth/password-reset/request` | Public | Begin reset without enumeration |
| POST | `/auth/password-reset/confirm` | Reset token | Complete reset |
| GET/PATCH | `/me` | User | Profile |
| GET | `/me/entitlements` | User + tenant | Plan state/limits; neutral on iOS |
| POST | `/tenants` | User | Create tenant |
| GET | `/tenants` | User | List user's authorized tenant memberships |
| GET | `/tenants/{tenantId}/members` | Owner | Members |
| GET/POST | `/tenants/{tenantId}/invitations` | Owner | ID-03: list/invite; active Family plan for creation, four reserved/active seats |
| DELETE | `/tenants/{tenantId}/invitations/{invitationId}` | Owner | ID-03: cancel a pending invitation |
| POST | `/invitations/accept` | User | Accept invite |
| PATCH/DELETE | `/tenants/{tenantId}/members/{memberId}` | Owner | Role change/removal |

## 3. Locations / inventory / media / labels

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET/POST | `/locations` | Member / Editor | Hierarchy |
| PATCH/DELETE | `/locations/{id}` | Editor | Rename/archive |
| GET/POST | `/containers` | Member / Editor | Tenant-scoped listing/create |
| GET/PATCH/DELETE | `/containers/{id}` | Member / Editor | Detail/edit/archive |
| GET/POST | `/containers/{id}/items` | Member / Editor | Items |
| PATCH/DELETE | `/items/{id}` | Editor | Update/remove item |
| GET | `/search?q=...&type=...` | Member | Tenant-scoped search |
| POST | `/containers/{id}/labels` | Editor | Generate or rotate QR token |
| POST | `/labels/{token}/resolve` | Member | Authorize scanned label → container ID |
| POST | `/media/upload-intents` | Editor | Authorized short-lived upload |
| POST | `/media/{id}/complete` | Editor | Validate/finalize processing |
| GET | `/containers/{id}/media` | Member | Authorized media list/short-lived URLs |
| DELETE | `/media/{id}` | Editor | Schedule delete |

Example create:

```http
POST /api/v1/containers
Authorization: Bearer <token>
Content-Type: application/json
Idempotency-Key: 28e0c75a-9c68-4e9a-83b8-90524b38d544
```

```json
{
  "tenantId": "00000000-0000-4000-8000-000000000111",
  "name": "Christmas Decorations",
  "locationId": "00000000-0000-4000-8000-000000000222",
  "description": "Top shelf"
}
```

Server must independently validate `tenantId` against a currently active membership and cannot allow client-side tenant overriding. Prefer tenant selection from an authorized server-backed session context.

Example read for a container should return authorized thumbnail URLs and items, never raw storage credentials or bank data.

**M1 feature-branch container mutations (not released):** `POST /containers` accepts `{tenantId,name}` and returns a private container ID; `PUT /containers/:id/sharing` accepts `{tenantId,shareMode,grants:[{userId,permission}]}`. Only the owning creator can update sharing. Revoking all selected grants uses `shareMode: "PRIVATE", grants: []`, evaluated again on every subsequent read. All requests require a live authenticated session, active tenant membership and RLS. The ID-03 disposable HTTP suite now exercises two independently registered users joining one tenant and the 404/200/404 sharing sequence. Browser/client and production acceptance remain separate. See [test procedure](../mock/documents/container-sharing-revocation.md).

## 4. Web-only credits / plan endpoints

**These endpoints must not be used to construct purchasing UI in the iOS app.**

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/web/credit-packages` | User | Packages and PHP price |
| GET | `/web/wallet` | Tenant owner | Balance and transactions |
| GET/POST | `/web/topups` | Tenant owner | Create/list top-up requests |
| POST | `/web/topups/{id}/evidence` | Tenant owner | Upload reference/proof privately |
| GET | `/web/plans` | User | Effective annual plan price |
| POST | `/web/subscriptions/redeem` | Tenant owner | Debit credits and activate/renew |
| GET | `/web/subscriptions/history` | Tenant owner | Plan transactions |

Request example:

```json
{
  "tenantId": "00000000-0000-4000-8000-000000000111",
  "planCode": "FAMILY",
  "expectedAnnualCredits": 1999,
  "idempotencyKey": "67c705b7-865b-4a12-8a7c-b04427c1bafe"
}
```

Responses must show source price version and resulting entitlement dates.

## 5. Admin-only endpoints

Separate admin authentication context and roles from tenant membership. Endpoints must **not** include inventory or media browsing.

| Method | Route | Permission | Purpose |
|---|---|---|---|
| GET | `/admin/overview` | OPERATIONS_READ | Aggregate KPIs |
| GET | `/admin/topups?status=PENDING` | PAYMENT_REVIEW | Review queue |
| POST | `/admin/topups/{id}/approve` | PAYMENT_APPROVE | Verified bank receipt approval |
| POST | `/admin/topups/{id}/reject` | PAYMENT_APPROVE | Reject with reason |
| GET | `/admin/subscriptions` | SUPPORT_READ | Subscription status metadata |
| GET | `/admin/revenue?period=month` | FINANCE_READ | Cash/credits/revenue metrics |
| GET | `/admin/operations/events` | OPERATIONS_READ | Redacted diagnostic events |
| GET | `/admin/audit` | AUDIT_READ | Immutable/admin action log |

Approval is safe **only** when an operator has independently confirmed receipt in their actual banking history. A screenshot alone is insufficient.

```json
{
  "verifiedBankReference": "SAMPLE-REFERENCE-NOT-REAL",
  "verifiedAmountMinor": 50000,
  "reviewNotes": "Confirmed in receiving bank history",
  "idempotencyKey": "15ce8d09-e064-44be-b0ca-bfc9af31d6f7"
}
```

Approval transaction must verify request state, match amount/recipient/reference, prevent duplicate crediting, append wallet ledger credit and write audit event atomically.

## 6. Versioning, security and observability

- OpenAPI generated from NestJS, checked into or generated for `packages/contracts`; avoid hand-written drifting models.
- Auth and object permissions checked **before** cache and media URL responses.
- `Idempotency-Key` required for top-up creation, admin approval, redemptions and any action where retry can double-apply a financial effect.
- API rate limiting by account and IP. Correlation ID in responses and logs.
- Log safe route template (`/containers/:id`), duration, status and request ID; redact tokens, raw IDs where not required, request/response bodies, payment proofs, credentials and sensitive filenames.
- Exclude bank QR details and purchasing endpoints from iOS app builds, navigation, marketing screens and deeplinks.
- Error handling must not reveal whether another tenant owns a guessed container or label.

## 7. Contract tests

Generate negative tests for unauthenticated access, wrong tenant, revoked member, expired label, over-limit container, media URL misuse, concurrent wallet approvals, retried redemptions, malformed tokens, and subscription expiry.

## M1 feature-branch route implementation (2026-11-11)

**Historical branch supplement (2026-11-12; superseded by the reconciliation below):** M1 implements the earlier login/Google/TOTP/refresh/logout/container-read routes **and** server-side registration, recipient-controlled email verification, password-reset, session management and privileged MFA/step-up controls. The `GET /admin/topups` route remains deliberately non-operational for payment review. A positive local register → verify → login was reported, but browser authorization is not accepted (own-tenant GET returned 403). Implementation is branch-only and has not been released to production. See [API audit](../audit/api/m1-implementation.md) and [Phase D](../audit/api/phase-d-real-provider-validation.md).


## Connected local implementation (2026-11-18)

M1 and ID-03 source are consolidated on main. The earlier own-tenant 403 blocker was resolved and retested; it is not a current blocker. The connected local frontend now exercises real account, tenant, inventory, invitation and session APIs. This is local engineering evidence, not production acceptance. See [local setup and scope](../development/connected-local-app.md) and [ID-03 audit](../audit/api/id03-family-membership.md).

All paths below use `/api/v1`. Inventory requests require an access session and explicit `tenantId` in the body, or query for GET/DELETE. Same-transaction tenant context, active membership and PostgreSQL object policies remain authoritative.

| Method | Route | Connected behavior |
| --- | --- | --- |
| GET | `/auth/me` | Own verified profile and MFA status |
| GET | `/auth/sessions` | Own sessions, including current-session marker |
| POST | `/containers` | Create private box with name and optional location atomically |
| GET | `/containers`, `/containers/:id` | Visible boxes with item counts and effective edit/manage capabilities |
| PATCH | `/containers/:id` | Creator with editing membership updates name/location |
| GET/POST | `/containers/:id/items` | Visible item list / authorized item creation |
| PATCH/DELETE | `/items/:id` | Authorized item update/removal; integer quantity 0–1,000,000 |
| POST | `/containers/:id/labels` | Creator with editing membership issues/replaces label, revoking the earlier locator |
| POST | `/labels/resolve` | Resolve hashed locator only within the caller's authorized tenant and object scope |

Label creation returns a one-time `/scan#token=…` URL; only its SHA-256 hash is stored. Possession grants no access. Invalid, rotated, cross-tenant and private locators return neutral 404. Verification, reset and invitation email links also carry proofs in URL fragments. Responses use `Cache-Control: no-store`.

`/__local/mail` and `/__local/family` belong to the Vite development sandbox, not the NestJS or public hosting contract. They require the explicit loopback/test profile; Family activation additionally checks actual owner membership and an allowlisted local database. There is no payment, credit grant, external email or hosted database migration in this flow.

Automated evidence includes the proxy-level register → verify → login → box/items → QR rotation → invitation acceptance → selected sharing → revocation → reset/refresh/logout flow. Browser/device interaction and production release acceptance remain separate.

## AWS hosting and rotation contract

AWS adoption changes infrastructure, not the client authority model: clients use HTTPS API routes and never receive SQL, SMTP, AWS or secret-store credentials. Runtime auth/content connections stay separate and private on Single-AZ RDS. Daily password rotation must preserve transaction-scoped authorization and refresh pools; do not automatically replay an ambiguous financial or invitation write. Versioned signing/pepper/MFA changes require compatibility tests for existing sessions and pending proofs. [Platform decision](aws-platform-decision.md), [rotation acceptance](../deployment/secret-rotation.md).
