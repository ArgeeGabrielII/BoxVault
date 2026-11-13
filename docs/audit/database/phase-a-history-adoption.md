# Database — Phase A: Prisma migration-history adoption

**Date:** 2026-11-12 (Asia/Manila)  
**Status:** VERIFIED on `m1-security-test`  
**System:** Neon PostgreSQL / Prisma 6.19.3  
**Scope:** `shiny-field-66278071` / `br-fragrant-salad-b3ntdaa0`; default `dev` excluded.  
**Method:** Operator executed local Prisma commands; independent read-only Neon ledger inspection followed.

## Objective

Adopt already existing baseline/tenancy security objects into Prisma's migration history without replaying the historical SQL or deleting any synthetic data.

## Actions and evidence

| Order | Action | Outcome | Evidence |
|---|---|---|---|
| A-01 | `prisma migrate status` before adoption | Six versioned migrations detected, no Prisma history | Local CLI output reported in engineering session |
| A-02 | `prisma migrate resolve --applied 202611110000_baseline` | Marked applied | Operator-supplied Prisma success output |
| A-03 | `prisma migrate resolve --applied 202611110001_m1_boundaries` | Marked applied | Operator-supplied Prisma success output |
| A-04 | Independent `_prisma_migrations` query | Both records had `finished_at` populated, no `rolled_back_at`, and no errors | Read-only Neon inspection |
| A-05 | `prisma migrate status` after adoption | Four migrations remained pending, `002`–`005` | Operator-supplied Prisma output |

## Security and preservation

Migration-history adoption wrote only the Prisma ledger; it did **not** execute the original migration SQL. Prior read-only inspection found composite tenant membership constraints, existing RLS helpers/policies and `ENABLE` + `FORCE` RLS on tenant/inventory/financial tables.

Historical equivalence review included structural and authorization checks, but does **not** constitute an independently signed formal parity proof for every function and grant definition; this remains a documentation/release review item.

**Preservation baseline:** 6 users; 2 tenants; 5 memberships; 5 containers; 2 sharing grants; 4 items; 4 media objects. Later phases preserved these counts.

## Change controls

No `migrate dev`, `migrate reset`, `db push`, overwrite of existing migrations or default-`dev` operations. This phase is concluded; see [Phase B](phase-b-schema-deployment.md) for subsequent deployment.

**Engineering sign-off:** Evidence verified; independent security/release approval still pending.
