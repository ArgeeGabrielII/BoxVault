# Neon M1 security test — Free-tier validation evidence

**Test date:** 2026-11-11. **Status:** Live PostgreSQL **RLS proof-of-concept passed**; canonical Prisma migration and NestJS HTTP E2E **NOT yet verified**.

## Neon resources actually used

- Organization: `org-purple-surf-16785136`
- Project: `shiny-field-66278071` (`boxvault-dev`)
- Plan verified **before and after**: `free_v3`, **no paid upgrade**
- Existing default branch: `dev` (`br-proud-dream-b3rjaxuk`) — **not modified**
- New test branch: `m1-security-test` (`br-fragrant-salad-b3ntdaa0`) — non-default, forked from `dev`
- Test branch compute: **0.25 CU fixed**; no optional Neon Auth, Functions, Object Storage or AI Gateway services enabled
- Database: `neondb`, PostgreSQL **18.6**, region `aws-ap-southeast-1` (Singapore)
- Existing role: `neondb_owner` has `BYPASSRLS` and was used **only** for fixture/schema setup
- New test role: `boxvault_runtime_m1`, **read_write** on `neondb`, verified `rolsuper=false`, `rolbypassrls=false`, `rolcreaterole=false`, `rolcreatedb=false`, not member of `neon_superuser`
- End-of-check branch count: **2 of 10** allowed

**Credentials were not copied into the repository or this report.** Neon credentials must remain managed by Neon and/or protected runtime secrets.

## What was deployed in the test database

Created a standalone schema named `m1lab` on `m1-security-test`, with synthetic versions of the core authorization tables:

- `members` (tenant, user, role and active/removed status)
- `containers` (owner, tenant, PRIVATE/SELECTED_MEMBERS/ALL_FAMILY)
- `grants` (selected recipient VIEW/EDIT)
- `items` and `media` (parent-container ownership)
- Transaction-local `app.user_id` and `app.tenant_id` context
- Reviewed proof-of-concept `SECURITY DEFINER` predicate `m1lab.allowed`, owned by Neon database owner, with a fixed `search_path`
- RLS `ENABLE` / `FORCE` and read/update policies on content tables

This is **a narrow proof of authorization behavior, not the full BoxVault Prisma data model or migration**. It deliberately does not integrate auth sessions, MFA or real object storage. Do **not** use `m1lab` as the production schema, and do not merge PR #4 based on these results alone.

## Executed test results (using actual restricted runtime role)

| Scenario | Expected | Observed | Result |
|---|---|---|---|
| Runtime role not superuser/BYPASSRLS/neon_superuser | Denied privileges | Verified no elevation | PASS |
| Family owner reads own PRIVATE/SELECTED/ALL_FAMILY | 3 containers | 3 | PASS |
| Cross-tenant A request for B item/media/container | None | None | PASS |
| Forged tenant selection by outsider B into A | None | None | PASS |
| Editor with VIEW grant sees SELECTED, not owner's PRIVATE | Selected + family | Selected + family | PASS |
| Viewer with EDIT grant sees selected but cannot modify | Reads allowed, writes denied | As expected | PASS |
| Unshared family member sees ALL_FAMILY only | One container | One | PASS |
| Editor with VIEW grant tries to edit selected item | Denied | 0 rows modified | PASS |
| Editor edits ALL_FAMILY item | Allowed | 1 row modified | PASS |
| Viewer edits ALL_FAMILY item | Denied | 0 rows modified | PASS |
| Editor tries to widen sharing | Denied | 0 rows modified | PASS |
| Editor tries to steal ownership | Denied | 0 rows modified | PASS |
| Unshared member tries to modify family item | Denied | 0 rows modified | PASS |
| Missing actor / tenant / both context claims | No rows | 0 rows each | PASS |
| Revoked editor reads containers/items/media | None | None immediately | PASS |
| Family tenant OWNER reads another member's PRIVATE container | Denied | 0 rows | PASS |
| Removed member reads own formerly private container | Denied | 0 rows | PASS |

## Important limitations and known next gates

1. The branch's canonical SQL migration `apps/api/prisma/migrations/202611110001_m1_boundaries/migration.sql` **cannot run on an empty database** because its prerequisite *baseline migration* is not committed. Do not apply it to `dev`.
2. This proof-of-concept uses `m1lab` tables rather than the Prisma-generated `public` tables. The proof passes for the lab policies, **not** necessarily for the draft application policies. In particular the original application `container_update` policy allowed editors to change sharing/ownership: fix and retest the actual migration.
3. The full test file `apps/api/test/authorization.e2e.test.mjs` was **not executed** in the Neon MCP connection. It needs a running Node.js test environment, Prisma migrations and secure test-role connection strings.
4. No HTTP controllers or session/MFA enforcement yet exist; do not claim an HTTP E2E authorization pass.
5. The lab uses a restricted DB role and transaction-scoped app claims, but arbitrary SQL access to the DB runtime role could spoof those GUCs. Never expose the runtime connection or arbitrary SQL to clients; enforce an authenticated server-side identity boundary.
6. Real RLS security acceptance still needs direct asset access, QR-token resolution, role/ACL races, negative writes, schema constraints, SQL-injection resilience, and a fresh full test after each RLS migration change.
7. To respect the hard Free-tier requirement, avoid additional always-on computes, paid features, storage expansion, extra projects or an account plan change. Free quotas may change; monitor the Neon console.

## Next safe action

Generate and commit a **Prisma baseline migration**, repair/review `202611110001_m1_boundaries`, then apply both on the isolated test branch, provision the correct runtime/fixture grants, and run the Node.js E2E suite in GitHub Actions or an equivalent isolated runner. Keep PR #4 as **draft** until its actual schema/role/HTTP gates pass.

## References

- [Milestone 1 security foundation](milestone-01-security-foundation.md)
- [Critical authorization E2E tests](critical-authorization-e2e-tests.md)
- [Family sharing security design](family-sharing-access-control.md)
- [Neon connection](neon-connection.md)
