# Development workflow

**Development snapshot (2026-11-12; PR #4):** The branch now has six Prisma migrations, separate restricted auth and tenant-content runtime connections, staged NestJS authentication, GitHub Actions authorization tests, and isolated Neon test-branch verification. The steps below are a **baseline local setup**, not a complete M1 runbook: do not run destructive migration/reset commands against the persistent Neon default `dev` branch. See [Neon configuration](neon-connection.md), [database audit](../audit/README.md), [M1 roadmap](../planning/delivery-roadmap.md) and [Phase D test guide](../audit/api/phase-d-real-provider-validation.md).

1. Use Node.js 22, Corepack and pnpm 10.
2. Run local PostgreSQL **or** use a development-only Neon branch. For Neon see [neon-connection.md](neon-connection.md).
3. Configure `apps/api/.env` from the provided example with `DATABASE_URL` (pooled runtime) and `DIRECT_URL` (direct migrations); never commit secrets.
4. Run `pnpm install && pnpm db:generate && pnpm db:migrate`.
5. Run `pnpm dev:api` and `pnpm dev:web` in separate terminals.
6. For iOS, run `xcodegen generate` in `apps/ios` and open the project with Xcode.

## Important caveats

- The initial Prisma schema does not activate tenant row-level security; implement migration SQL and transaction-scoped tenant context before protected routes.
- No sensitive endpoints or admin payment actions are exposed in this scaffold.
- Do not test with real personal data until security and backup controls have been verified.
- Run CI locally with `pnpm typecheck && pnpm build`.
