# M1 — Container sharing and immediate revocation test

**State:** implementation exists on draft PR #4; **live two-account HTTP acceptance not yet demonstrated**. This procedure is for the local tester, not production release.

## What changed

The protected container API now offers:

- `POST /api/v1/containers` — body `{ "tenantId": "<uuid>", "name": "M1 test shared container" }`. Requires an authenticated, active, editing-capable tenant member; creates a private container; returns `data.id` and `data.shareMode`. The QR/public token is generated server-side and **not returned**.
- `PUT /api/v1/containers/:id/sharing` — body `{ "tenantId": "<uuid>", "shareMode": "SELECTED_MEMBERS", "grants": [{ "userId": "<active-family-user-uuid>", "permission": "VIEW" }] }`. Only the container creator can mutate sharing; grantees must be active members of that same tenant.
- `PUT /api/v1/containers/:id/sharing` — body `{ "tenantId": "<uuid>", "shareMode": "PRIVATE", "grants": [] }` to remove all selected grants atomically. Mode `ALL_FAMILY` with empty grants is also supported.
- `GET /api/v1/containers/:id?tenantId=<uuid>` — returns HTTP 200 for an authorized member and HTTP 404 for anyone lacking object visibility (without leaking existence).

Only the scoped runtime identity and existing RLS checks authorize tenant and object requests. The app doesn't trust client-supplied membership claims. Login tokens remain in the mock tab's memory.

## Prerequisite: two active accounts in one tenant

**Crucial:** two independent new registrations create **two independent personal tenants**, not a family. To test selected-member sharing, the creator (Account A) and recipient (Account B) must already hold active memberships in the *same* family tenant. The feature branch **does not yet implement** accepting family invitations/seat management. Do not add a member with raw SQL to the persistent Neon branch or use the migration owner as a consumer-facing workaround. Complete family invitation acceptance in a later reviewed phase, or use the disposable PostgreSQL fixture suite described below.

## Browser verification once that prerequisite is met

1. Pull the feature branch; restart the NestJS API and local mock server. Open `http://localhost:5173/boxvault-m1-registration-harness.html` in two separate tabs.
2. Sign in as the creator (A) and as the active same-tenant member (B), one account per tab. Both must use the shared family tenant UUID in the new **Step 6** fields, **not** their separate personal tenant IDs.
3. A creates a new **PRIVATE** disposable container. Copy the returned container UUID to B's Step 6.
4. B selects **Check access** and must receive **HTTP 404**.
5. A enters B's User UUID, selects VIEW, clicks **Share with selected family member**. Expected response HTTP 200 (NestJS PUT) without errors.
6. B immediately checks the same container again with the **same active session**. Expected **HTTP 200**.
7. A clicks **Revoke selected access (PRIVATE)**, expected HTTP 200.
8. Without refreshing or re-logging in, B checks again. Expected **HTTP 404**. A's access stays HTTP 200. A separate same-family member with no selected grant remains HTTP 404.
9. Save **statuses only** in the [Phase D audit](../../audit/api/phase-d-real-provider-validation.md); never paste JWTs, passwords, QR tokens, customer container data, or verification links.

The mock does not implement an invitation flow or automated creation of family memberships. **Don't infer a two-account PASS from the single-account 401/200/403 tenant test.**

## Disposable PostgreSQL acceptance (no Neon writes)

On isolated ephemeral PostgreSQL with versioned M1 migrations and separate fixture/admin and restricted/runtime identities:

```bash
pnpm --filter @boxvault/api db:generate
pnpm --filter @boxvault/api test:authz:e2e
```

Required environment variables: `AUTHZ_ADMIN_DATABASE_URL` and `AUTHZ_RUNTIME_DATABASE_URL` for the **disposable instance only**. Running this test against persistent `m1-security-test` or default `dev` is **prohibited**: the suite seeds, edits, and removes fixture users/tenants/containers.

- SEC-03: private container and children invisible to sibling members.
- SEC-04: selected-member VIEW and EDIT grants enforce tenant-role intersection.
- SEC-05: ALL_FAMILY visible to active members, role ceilings still enforced.
- SEC-06: removing an active member blocks container/item/media and grant visibility.
- **SEC-11 (new):** delete one recipient's SELECTED_MEMBERS grant; assert immediate denial to that container, item, media and grant metadata in fresh transactions; owner's access remains intact; ungranted family members remain denied.

**Acceptance status:** SEC-11 source assertion added; CI outcome and browser two-account status must be inspected before declaring it passed. Container and item/media RLS do not replace future media HTTP, search, QR and cache invalidation tests.
