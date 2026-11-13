# Mock test data — catalog and boundaries

This folder is the **documentation source of truth** for mock test data, fixture boundaries, expected results, and safe examples. It contains **no real user emails, passwords, verification tokens, JWTs, connection strings, or live tenant UUIDs**.

## Source of the test data

- Isolated Neon test branch: `m1-security-test`. **Never** run mock data operations on the default `dev` branch or production.
- Pre-registration baseline preserved for regression checks (recorded November 12, 2026): **6 users, 2 tenants, 5 memberships, 5 containers, 2 container access grants, 4 items, 4 media assets**.
- After three synthetic registration/verification flows: **9 users, 5 tenants, 8 memberships**, while the 5 containers, 2 grants, 4 items and 4 media assets were unchanged. These are **historical audit counts**, not an instruction to recreate or reset records; use read-only checks for current counts.
- Every new account should receive one new personal tenant and one active OWNER membership **after verification**, not merely after the initial register request.
- New personal tenants can have **zero containers**. An empty list with HTTP 200 is valid.

## Test-data dictionary

| Name | Example / source | Usage |
|---|---|---|
| Test email | `boxvault-test@example.invalid` (illustration only; use an inbox you control for Brevo delivery) | Register, verify, login, request password reset |
| Test password | **Generate locally; never store in Git** | Register, verification-established login password, reset |
| User UUID | `<user-uuid>` (runtime-returned) | Identify the new test user in development |
| Own tenant UUID | `<own-tenant-uuid>` (runtime-returned) | Positive inventory isolation check |
| Unrelated tenant UUID | `<other-tenant-uuid>` (runtime-returned) | Negative inventory isolation check |
| Email verification token | Read from one-time Brevo link | Establish verified account; never commit or paste in reports |
| Password-reset token | Read from one-time Brevo link | Change mock account password via existing API |
| JWT access token | Held in tab memory only | Authenticated request; never display or save |

The UUID placeholders are **not valid UUIDs**. The local mock obtains actual IDs from `GET /api/v1/auth/dev-test-context` after a successful authenticated login, scoped to the isolated test branch. Use the [read-only fallback lookup](../documents/tenant-isolation-readonly-lookup.md) only when auto-fill is unavailable.

## Expected read-only acceptance results

| Request | Expected HTTP |
|---|---|
| `GET /api/v1/containers?tenantId=<own>` without bearer | 401 |
| Same request with a verified session for the owning user | 200 |
| `GET /api/v1/containers?tenantId=<unrelated>` with that session | 403 |

As of the latest operator test, the own-tenant HTTP check produced **403** unexpectedly. Do **not** mark it passed merely because the database RLS fixture check succeeded. Consult the [Phase D audit](../../audit/api/phase-d-real-provider-validation.md).

## Rules for adding mock data

1. Use synthetic labels only. No personal customer information or secret material in this folder.
2. Do not put account secrets or real test IDs into repository data files, snapshots, screenshots, or audit evidence.
3. If adding executable fixture files later, place non-sensitive deterministic fixtures under root `mock/data/`, and document schema, provenance, cleanup rules, and expected outputs here. Do not silently seed or overwrite existing Neon data.
4. Preserve existing authorization/RLS boundaries and never substitute mocked success for an observed result.

Related: [Mock documentation](../documents/README.md) and [local HTML tester](../../../mock/boxvault-m1-registration-harness.html).
