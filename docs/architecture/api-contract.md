# Proposed REST API Contract

Status: API design draft. On `main`, only `GET /api/v1/health` is implemented. On the **M1 feature branch**, partial auth/MFA routes plus authenticated `GET /containers` and `GET /containers/:id` and a deny-by-default admin `GET /admin/topups` route are implemented. Most routes below remain specifications; see [m1-authentication-implementation.md](../m1-authentication-implementation.md).

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
| POST | `/tenants/{tenantId}/invitations` | Owner | Invite member, enforce four seats |
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

The M1 feature branch currently implements `POST /auth/login`, `POST /auth/google`, `POST /auth/providers/google/link`, `POST /auth/mfa/challenges/verify`, `POST /auth/mfa/totp/setup`, `POST /auth/mfa/totp/confirm`, `POST /auth/refresh`, `POST /auth/logout`, guarded `GET /containers` and `GET /containers/:id`, plus fail-closed `GET /admin/topups`. Endpoints not listed here remain proposed. In particular, first-time registration, password reset and all customer admin-payment processing are **not yet implemented**. These endpoints have not been released to production.
