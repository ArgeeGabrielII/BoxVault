# Neon PostgreSQL integration — BoxVault

**Status:** Repository configuration prepared; actual credentials and connectivity **not** installed or verified. Last updated 2026-11-11.

## Neon project reference

- Project: `shiny-field-66278071`
- Organization: `org-purple-surf-16785136`
- Environment: **development only**. Do not put private customer inventory or payment proofs in this project until security controls have passed.
- This project ID and org ID are identifiers, **not** PostgreSQL passwords or database endpoint names.

## Database URL configuration

NestJS/Prisma uses two connection types:

| Variable | Purpose | Neon endpoint |
|---|---|---|
| `DATABASE_URL` | Backend Prisma runtime queries | **Pooled** Postgres connection (typically endpoint hostname includes `-pooler`) |
| `DIRECT_URL` | Prisma migrations/introspection where direct connections are required | **Direct (non-pooled)** Postgres connection |

Prisma 6 reads `directUrl = env("DIRECT_URL")` in `apps/api/prisma/schema.prisma`. Both values are server-only and must never be prefixed with `VITE_` or embedded in Swift/iOS apps.

Get both URLs in the **Neon Console** for the exact project, branch, database and role; select pooled vs direct in the connection dialogue. Copy into **untracked** `apps/api/.env` (not into GitHub README, issues, pull requests or chat). If using an environment loader or deployment secret manager, configure both there instead.

Example **without real credentials**:

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@POOLER_HOST/DBNAME?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@DIRECT_HOST/DBNAME?sslmode=require"
```

Passwords with reserved URL characters must be percent-encoded in a URI. Require TLS (`sslmode=require`) and verify remote certificates as supported by the driver and hosting deployment. A single high-privilege database role should **not** be reused for a security-first production runtime.

## Local development

1. Create a development branch/database in Neon; do not point tests at a production branch.
2. From `apps/api/.env.example`, create a local untracked `apps/api/.env`; replace both placeholder URLs using Neon Console's connection details.
3. Install workspace dependencies with `pnpm install`.
4. Generate Prisma Client with `pnpm db:generate`.
5. Once migrations are **reviewed and valid**, use `pnpm --filter @boxvault/api db:deploy` on the target environment. Do **not** run unreviewed M1 RLS SQL against a persistent Neon database.
6. Start the API with `pnpm dev:api` and verify `/api/v1/health`; the health route alone does not prove database connectivity, so verify Prisma migrations/queries separately.

`prisma migrate dev` is intended for local development and may need shadow database permissions; avoid pointing it at shared hosted datasets. Use `migrate deploy` for committed migration files.

## ChatGPT access

ChatGPT's **Neon integration must be explicitly installed/connected by the owner** before an agent can inspect branches, roles and connection details through Neon's account APIs. Merely giving a Neon project/organization ID does not authorize database access. Grant the minimum project-level permissions needed; do not expose passwords in conversation.

For automated E2E RLS testing, prefer **disposable PostgreSQL in GitHub Actions**, or a dedicated ephemeral Neon branch with restricted role credentials managed in CI secrets. The M1 test suite needs TWO independent roles:
- Fixture setup role with the appropriate privileged ability to create isolated test records.
- Runtime role with **no superuser, BYPASSRLS or table ownership** and strictly limited grants.

Neon managed PostgreSQL permissions may differ from a self-hosted PostgreSQL superuser. Confirm these capabilities before trying to run the current test harness. Do not weaken RLS role checks just to make the tests green.

## Next prerequisites

- [ ] Connect the Neon integration to ChatGPT, scoped to the intended project.
- [ ] Create actual `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) values in protected environment configuration.
- [ ] Verify a direct database connection with a harmless query.
- [ ] Repair and validate the base Prisma migration and M1 RLS candidate before applying.
- [ ] Provision restricted RLS runtime role and independent fixture role.
- [ ] Execute authorization tests and capture CI evidence; currently **not run**.
- [ ] Rotate any connection credentials accidentally disclosed publicly.
- [ ] Keep future production DB in separate credentials/project from development.

## Sources

- Neon connection strings: https://neon.com/docs/connect/connect-from-any-app
- Neon guidance for branch-scoped environment variables: https://neon.com/blog/branch-first-dev-loop
- Prisma schema documentation: https://www.prisma.io/docs/orm/prisma-schema/overview

**Source access note:** The user-provided URL `https://neon.com/get-started/prompt.md` could not be retrieved from this session. The instructions here reflect the existing BoxVault Prisma 6 setup and publicly documented Neon connection patterns, rather than a claim to have followed that file verbatim.
