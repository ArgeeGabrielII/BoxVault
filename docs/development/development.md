# Development workflow

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
